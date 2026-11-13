import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { commitAll, git, removeDir, tempDir } from './repos'

async function runCheckUp(page: Page) {
  await page.keyboard.press('Control+Shift+P')
  const palette = page.locator('.command-palette')
  const input = palette.getByRole('textbox', { name: 'Type a command…' })
  await expect(input).toBeFocused()
  await input.fill('Clean up repository')
  await expect(palette.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
}

// The body is sized up front, so results arriving after the dialog opened never resize it.
async function expectSteadyBody(page: Page) {
  const body = page.locator('.checklist-body')
  const rowHeight = await body.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--row-md')))
  expect((await body.boundingBox())!.height).toBeCloseTo(rowHeight * 9, 0)
}

type Sampled = { heights: Set<number>; labelLefts: Set<number>; sawLoading: boolean }

/**
 * Watches the dialog every frame from before it opens, once its opening animation has settled: its height, where
 * the first row's label starts, and whether it showed as loading.
 */
const watchDialogLayout = (page: Page) =>
  page.evaluate(() => {
    const seen: Sampled = { heights: new Set(), labelLefts: new Set(), sawLoading: false }
    Object.assign(window, { checkupSampled: seen })
    const sample = () => {
      const modal = document.querySelector<HTMLElement>('.modal')
      if (modal && Math.abs(modal.getBoundingClientRect().width - modal.offsetWidth) < 0.5) {
        seen.heights.add(Math.round(modal.getBoundingClientRect().height))
        const label = modal.querySelector('.checklist-label, .task-label')
        if (label) seen.labelLefts.add(Math.round(label.getBoundingClientRect().left))
        if (label?.textContent === 'Checking…') seen.sawLoading = true
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })

const dialogLayout = (page: Page) =>
  page.evaluate(() => {
    const seen = (window as unknown as { checkupSampled: Sampled }).checkupSampled
    return { heights: [...seen.heights], labelLefts: [...seen.labelLefts], sawLoading: seen.sawLoading }
  })

const localBranches = (repo: string) => git(repo, 'branch', '--format=%(refname:short)').trim().split('\n')
const looseObjects = (repo: string) => Number(/^count: (\d+)/m.exec(git(repo, 'count-objects', '-v'))?.[1])

test('the clean-up lists merged and gone branches and deletes only the ticked ones', async ({ open, small }) => {
  const remote = tempDir('remote')
  git(remote, 'init', '-q', '--bare')
  git(small, 'remote', 'add', 'origin', join(remote))
  git(small, 'branch', 'done')
  git(small, 'switch', '-q', '-c', 'squashed')
  commitAll(small, 'Work that was squash merged')
  git(small, 'push', '-q', '-u', 'origin', 'squashed')
  git(small, 'switch', '-q', 'main')
  git(small, 'push', '-q', 'origin', '--delete', 'squashed')
  git(small, 'fetch', '-q', '--prune')

  const page = await open(small)
  // The sidebar marks the branch whose upstream was deleted.
  const goneBranch = page.locator('[data-pane="sidebar"] [role="row"][data-key="refs/heads/squashed"]')
  await expect(goneBranch).toContainText('gone')
  await watchDialogLayout(page)
  await runCheckUp(page)
  const dialog = page.getByRole('dialog', { name: 'Clean up repository' })
  const rows = dialog.locator('.checklist-row')
  await expect(dialog.locator('.summary-tile').first()).toContainText('2 to clean up')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('merged into main')
  await expect(rows.nth(1)).toContainText('upstream gone, 1 commit not in main')
  await expect(rows.nth(2)).toContainText('already compact')
  await expect(rows.nth(2)).toHaveAttribute('aria-selected', 'false')
  await expect(rows.nth(0)).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Clean up 2 items' })).toBeEnabled()
  await expectSteadyBody(page)
  await expect(dialog.locator('.modal-msg')).toHaveText('Tick what to clean up, then confirm.')
  // It opened before git answered.
  expect((await dialogLayout(page)).sawLoading).toBe(true)

  // A group unticks in one go; Ctrl+A ticks every row, then none.
  const confirm = dialog.getByRole('button', { name: /^Clean up/ })
  await dialog.getByRole('button', { name: 'Untick all' }).click()
  await expect(confirm).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Tick all' })).toBeVisible()
  await page.keyboard.press('Control+A')
  await expect(confirm).toHaveText('Clean up 3 items')
  await page.keyboard.press('Control+A')
  await expect(confirm).toBeDisabled()

  // Escape leaves every branch alone.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(localBranches(small)).toEqual(['done', 'main', 'squashed'])

  await runCheckUp(page)
  await expect(rows.nth(0)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(dialog.getByRole('button', { name: 'Clean up 1 item' })).toBeEnabled()
  await page.keyboard.press('Control+Enter')
  // The dialog stays, at the same size: the task ticked off is the record, and the tiles are read again.
  const tasks = dialog.locator('.task-row')
  await expect(tasks).toHaveCount(1)
  await expect(tasks).toHaveAttribute('data-state', 'done')
  await expect(tasks).toContainText('Delete squashed')
  await expect(dialog.locator('.modal-msg')).toHaveText('Deleted squashed.')
  await expect(dialog.locator('.summary-tile').first()).toContainText('1 to clean up')
  await expectSteadyBody(page)
  expect(localBranches(small)).toEqual(['done', 'main'])
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(goneBranch).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.status-message')).toContainText('Deleted squashed')
  // Loading, choosing, working and the result all kept the dialog's size and the rows' labels in one place.
  const layout = await dialogLayout(page)
  expect(layout.heights).toHaveLength(1)
  expect(layout.labelLefts).toHaveLength(1)
  removeDir(remote)
})

test('the clean-up opens from the toolbar menu and compacts a tidy repository only when asked', async ({ open, small }) => {
  const page = await open(small)
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Clean up repository…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Clean up repository' })
  await expect(dialog.locator('.summary-tile.attention')).toHaveCount(0)
  const confirm = dialog.getByRole('button', { name: /^Clean up/ })
  await expect(confirm).toBeDisabled()

  const compact = dialog.locator('.checklist-row')
  await expect(compact).toHaveCount(1)
  await expectSteadyBody(page)
  // Opened with the mouse too, the first row has focus, so Space ticks it straight away.
  await expect(compact).toBeFocused()
  await page.keyboard.press('Space')
  await expect(confirm).toHaveText('Clean up 1 item')
  expect(looseObjects(small)).toBeGreaterThan(0)
  await page.keyboard.press('Control+Enter')
  await expect(dialog.locator('.task-row')).toHaveAttribute('data-state', 'done')
  await expect(dialog.locator('.task-row')).toContainText('Compact repository')
  expect(looseObjects(small)).toBe(0)
  // Escape waits for the work to finish; Close taking focus says it has.
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.status-message')).toContainText('Compacted')
})

test('a clean-up task that fails is marked, the rest are skipped and the dialog stays open', async ({ open, small }) => {
  git(small, 'branch', 'done')
  const page = await open(small)
  await runCheckUp(page)
  const dialog = page.getByRole('dialog', { name: 'Clean up repository' })
  await expect(dialog.locator('.checklist-row')).toHaveCount(2)
  await expect(dialog.locator('.checklist-row').first()).toBeFocused()
  await page.keyboard.press('Control+A')
  await expect(dialog.getByRole('button', { name: 'Clean up 2 items' })).toBeEnabled()

  // Another git holding the branch's lock makes the delete fail.
  const lock = join(small, '.git', 'refs', 'heads', 'done.lock')
  writeFileSync(lock, '')
  await page.keyboard.press('Control+Enter')
  const tasks = dialog.locator('.task-row')
  await expect(tasks).toHaveCount(2)
  await expect(tasks.nth(0)).toHaveAttribute('data-state', 'failed')
  await expect(tasks.nth(1)).toHaveAttribute('data-state', 'skipped')
  await expect(dialog.locator('.modal-msg')).toHaveText('Stopped at "Delete done". Nothing after it ran.')
  await expectSteadyBody(page)
  rmSync(lock)
  expect(localBranches(small)).toEqual(['done', 'main'])
  expect(looseObjects(small)).toBeGreaterThan(0)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
})

test('a gone branch checked out in another worktree is not offered, and the clean-up says why', async ({ open, small }) => {
  const remote = tempDir('remote')
  const worktree = tempDir('worktree')
  git(remote, 'init', '-q', '--bare')
  git(small, 'remote', 'add', 'origin', join(remote))
  git(small, 'switch', '-q', '-c', 'parked')
  commitAll(small, 'Parked work')
  git(small, 'push', '-q', '-u', 'origin', 'parked')
  git(small, 'switch', '-q', 'main')
  git(small, 'push', '-q', 'origin', '--delete', 'parked')
  git(small, 'fetch', '-q', '--prune')
  git(small, 'worktree', 'add', '-q', join(worktree, 'parked'), 'parked')

  const page = await open(small)
  await runCheckUp(page)
  const dialog = page.getByRole('dialog', { name: 'Clean up repository' })
  const rows = dialog.locator('.checklist-row')
  await expect(rows).toHaveCount(2)
  await expect(dialog.locator('.summary-tile').first()).toContainText('1 gone but checked out')
  await expect(rows.nth(1)).toContainText('parked')
  await expect(rows.nth(1)).toContainText('checked out in')
  await expect(rows.nth(1)).toHaveAttribute('aria-disabled', 'true')
  // Ctrl+A ticks only what can be cleaned, and a click on the kept row ticks nothing.
  await expect(rows.nth(0)).toBeFocused()
  await page.keyboard.press('Control+A')
  const confirm = dialog.getByRole('button', { name: 'Clean up 1 item' })
  await expect(confirm).toBeEnabled()
  await rows.nth(1).click({ force: true })
  await expect(confirm).toBeEnabled()
  await expectSteadyBody(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  git(small, 'worktree', 'remove', '--force', join(worktree, 'parked'))
  removeDir(worktree)
  removeDir(remote)
})
