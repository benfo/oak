import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { commitAll, git, removeDir, tempDir } from './repos'

async function runCleanUp(page: Page) {
  await page.keyboard.press('Control+Shift+P')
  const palette = page.locator('.command-palette')
  const input = palette.getByRole('textbox', { name: 'Type a command…' })
  await expect(input).toBeFocused()
  await input.fill('Clean up branches')
  await expect(palette.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
}

const localBranches = (repo: string) => git(repo, 'branch', '--format=%(refname:short)').trim().split('\n')

test('clean up branches lists merged and gone branches and deletes only the ticked ones', async ({ open, small }) => {
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
  await runCleanUp(page)
  const dialog = page.getByRole('dialog', { name: 'Clean up branches' })
  const rows = dialog.getByRole('row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('merged into main')
  await expect(rows.nth(1)).toContainText('upstream gone, 1 commit not in main')
  await expect(rows.nth(0)).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Delete 2 branches' })).toBeEnabled()

  // Escape leaves every branch alone.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(localBranches(small)).toEqual(['done', 'main', 'squashed'])

  await runCleanUp(page)
  await expect(rows.nth(0)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(dialog.getByRole('button', { name: 'Delete 1 branch' })).toBeEnabled()
  await page.keyboard.press('Control+Enter')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.status-message')).toContainText('Deleted squashed')
  expect(localBranches(small)).toEqual(['done', 'main'])
  removeDir(remote)
})

test('clean up branches says so when there is nothing to delete', async ({ open, small }) => {
  const page = await open(small)
  await runCleanUp(page)
  await expect(page.locator('.status-message')).toContainText('Nothing to clean up')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
