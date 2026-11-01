import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { commitAll, git, initRepo, removeDir, tempDir, write } from './repos'

function fourCommits() {
  const dir = tempDir('range')
  initRepo(dir)
  for (const n of [1, 2, 3, 4]) {
    write(dir, `f${n}.txt`, `${n}\n`)
    commitAll(dir, `Commit ${n}`)
  }
  return dir
}

const subjects = (repo: string) => git(repo, 'log', '--format=%s').trim().split('\n')
const row = (page: Page, subject: string) => page.locator('.commit-list').getByRole('option', { name: new RegExp(subject) })
const selectedRows = (page: Page) => page.locator('.commit-list [role=option][aria-selected=true]')
const summary = (page: Page) => page.getByRole('region', { name: 'Selected commits' })

test.describe('selecting a range of commits', () => {
  test('Shift+click selects the commits between, and a plain click ends the range', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await row(page, 'Commit 4').click()
      await row(page, 'Commit 2').click({ modifiers: ['Shift'] })
      await expect(selectedRows(page)).toHaveCount(3)
      await expect(summary(page)).toContainText('3 commits selected')
      await expect(summary(page).getByRole('listitem')).toHaveCount(3)

      await row(page, 'Commit 1').click({ modifiers: ['Shift'] })
      await expect(summary(page)).toContainText('4 commits selected')

      await row(page, 'Commit 3').click()
      await expect(summary(page)).toHaveCount(0)
      await expect(selectedRows(page)).toHaveCount(1)
    } finally {
      removeDir(repo)
    }
  })

  test('Shift+arrows grow and shrink the range from where it started, and Escape clears it', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await row(page, 'Commit 4').click()
      await page.keyboard.press('Shift+ArrowDown')
      await page.keyboard.press('Shift+ArrowDown')
      await expect(summary(page)).toContainText('3 commits selected')
      await page.keyboard.press('Shift+ArrowUp')
      await expect(summary(page)).toContainText('2 commits selected')
      await page.keyboard.press('Shift+ArrowUp')
      await expect(summary(page)).toHaveCount(0)
      await expect(selectedRows(page)).toHaveCount(1)

      await page.keyboard.press('Shift+End')
      await expect(summary(page)).toContainText('4 commits selected')
      await page.keyboard.press('Escape')
      await expect(summary(page)).toHaveCount(0)
      await expect(selectedRows(page)).toHaveCount(1)
      await expect(page.locator('.commit-list')).toBeFocused()
    } finally {
      removeDir(repo)
    }
  })

  test('the summary squashes the range with an edited message', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await row(page, 'Commit 4').click()
      await row(page, 'Commit 2').click({ modifiers: ['Shift'] })
      await summary(page).getByRole('button', { name: 'Squash…' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: 'Squash 3 commits' })).toBeVisible()
      await expect(dialog.getByRole('textbox', { name: 'Message' })).toHaveValue('Commit 2\n\nCommit 3\n\nCommit 4')
      await dialog.getByRole('textbox', { name: 'Message' }).fill('Two to four')
      await page.keyboard.press('Control+Enter')
      await expect.poll(() => subjects(repo)).toEqual(['Two to four', 'Commit 1'])
      await expect(summary(page)).toHaveCount(0)
      await expect(page.locator('.commit-list')).toContainText('Two to four')
      await expect(selectedRows(page)).toHaveCount(1)
      await expect(page.locator('.history-navigation-status')).toHaveCount(0)
      await expect(page.locator('.details-files')).toBeVisible()
    } finally {
      removeDir(repo)
    }
  })

  test('the context menu on a range offers only Combine, with the count in its items', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await row(page, 'Commit 4').click()
      await row(page, 'Commit 3').click({ modifiers: ['Shift'] })
      await row(page, 'Commit 4').click({ button: 'right' })
      const menu = page.getByRole('menu')
      await expect(menu.getByRole('menuitem')).toHaveCount(1)
      await menu.getByRole('menuitem', { name: 'Combine 2 commits' }).click()
      await expect(page.getByRole('menuitem', { name: /^Squash 2 commits…/ })).toBeVisible()
      await page.getByRole('menuitem', { name: /^Fixup 2 commits/ }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: /Fixup into/ })).toBeVisible()
      await page.keyboard.press('Enter')
      await expect.poll(() => subjects(repo)).toEqual(['Commit 3', 'Commit 2', 'Commit 1'])
    } finally {
      removeDir(repo)
    }
  })

  test('the palette squashes the selected range', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await row(page, 'Commit 3').click()
      await row(page, 'Commit 1').click({ modifiers: ['Shift'] })
      await page.keyboard.press('Control+Shift+P')
      const palette = page.locator('.command-palette')
      await palette.getByRole('textbox', { name: 'Type a command…' }).fill('Squash 3 selected')
      await expect(palette.getByRole('option')).toHaveCount(1)
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog').getByRole('heading', { name: 'Squash 3 commits' })).toBeVisible()
    } finally {
      removeDir(repo)
    }
  })

  test('the summary buttons are disabled with the reason shown when changes are uncommitted', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      write(repo, 'f1.txt', 'edited\n')
      await expect(page.locator('.commit-list')).toContainText('Working changes')
      await row(page, 'Commit 4').click()
      await row(page, 'Commit 2').click({ modifiers: ['Shift'] })
      await expect(summary(page)).toContainText('commit or stash your changes first')
      await expect(summary(page).getByRole('button', { name: 'Squash…' })).toBeDisabled()
      await expect(summary(page).getByRole('button', { name: 'Fixup' })).toBeDisabled()
    } finally {
      removeDir(repo)
    }
  })

  test('entering and leaving a range does not move the commit list or its rows', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      const rects = () =>
        page.evaluate(() => {
          const box = (el: Element | null) => {
            const r = el?.getBoundingClientRect()
            return r && [r.x, r.y, r.width, r.height].map(Math.round)
          }
          return {
            list: box(document.querySelector('.commit-list')),
            rows: [...document.querySelectorAll('.commit-list [role=option]')].map(box)
          }
        })
      await row(page, 'Commit 4').click()
      const before = await rects()
      await row(page, 'Commit 2').click({ modifiers: ['Shift'] })
      await expect(summary(page)).toBeVisible()
      expect(await rects()).toEqual(before)
      await page.keyboard.press('Escape')
      await expect(summary(page)).toHaveCount(0)
      expect(await rects()).toEqual(before)
    } finally {
      removeDir(repo)
    }
  })

  test('Ctrl+click still compares two commits and does not start a range', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await row(page, 'Commit 4').click()
      await row(page, 'Commit 2').click({ modifiers: ['Control'] })
      await expect(summary(page)).toHaveCount(0)
      await expect(selectedRows(page)).toHaveCount(2)
    } finally {
      removeDir(repo)
    }
  })
})
