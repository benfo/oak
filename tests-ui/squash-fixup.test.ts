import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { commitAll, git, initRepo, removeDir, tempDir, write } from './repos'

function fourCommits() {
  const dir = tempDir('squash')
  initRepo(dir)
  for (const n of [1, 2, 3, 4]) {
    write(dir, `f${n}.txt`, `${n}\n`)
    commitAll(dir, `Commit ${n}`)
  }
  return dir
}

const subjects = (repo: string) => git(repo, 'log', '--format=%s').trim().split('\n')

async function chooseCombine(page: Page, item: RegExp) {
  await page.getByRole('menuitem', { name: 'Combine commits' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

const row = (page: Page, subject: string) => page.locator('.commit-list').getByRole('option', { name: new RegExp(subject) })

async function openCommitMenu(page: Page, subject: string) {
  await row(page, subject).click({ button: 'right' })
}

test.describe('squash and fixup', () => {
  test('squashes a commit into the previous one with an edited message, then undoes it', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await openCommitMenu(page, 'Commit 3')
      await chooseCombine(page, /^Squash into previous…/)

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: 'Squash 2 commits' })).toBeVisible()
      await expect(dialog.getByRole('listitem')).toHaveCount(2)
      const message = dialog.getByRole('textbox', { name: 'Message' })
      await expect(message).toBeFocused()
      await expect(message).toHaveValue('Commit 2\n\nCommit 3')
      await message.fill('Commits two and three')
      await page.keyboard.press('Control+Enter')

      await expect.poll(() => subjects(repo)).toEqual(['Commit 4', 'Commits two and three', 'Commit 1'])
      await page.getByRole('button', { name: 'Undo' }).click()
      await expect.poll(() => subjects(repo)).toEqual(['Commit 4', 'Commit 3', 'Commit 2', 'Commit 1'])
    } finally {
      removeDir(repo)
    }
  })

  test('fixup keeps the older commit message after a confirmation naming it', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await openCommitMenu(page, 'Commit 4')
      await chooseCombine(page, /^Fixup into previous/)

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: /Fixup into [0-9a-f]{8}/ })).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Fixup' })).toBeFocused()
      await page.keyboard.press('Enter')

      await expect.poll(() => subjects(repo)).toEqual(['Commit 3', 'Commit 2', 'Commit 1'])
      expect(git(repo, 'show', 'HEAD:f4.txt')).toBe('4\n')
    } finally {
      removeDir(repo)
    }
  })

  test('warns that already pushed commits will need a force push', async ({ open }) => {
    const repo = fourCommits()
    const remote = tempDir('squash-remote')
    try {
      git(remote, 'init', '-q', '--bare')
      git(repo, 'remote', 'add', 'origin', remote)
      git(repo, 'push', '-q', '-u', 'origin', 'main')
      write(repo, 'f5.txt', '5\n')
      commitAll(repo, 'Commit 5')
      const page = await open(repo, 'history')
      await openCommitMenu(page, 'Commit 5')
      await chooseCombine(page, /^Fixup into previous/)
      await expect(page.getByRole('dialog')).toContainText('1 of the 2 commits this rewrites is already pushed')

      await page.keyboard.press('Escape')
      await openCommitMenu(page, 'Commit 4')
      await chooseCombine(page, /^Fixup into previous/)
      await expect(page.getByRole('dialog')).toContainText('2 of the 3 commits this rewrites are already pushed')
    } finally {
      removeDir(repo)
      removeDir(remote)
    }
  })

  test('is not offered in a file history, saying so', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await openCommitMenu(page, 'Commit 3')
      await expect(page.getByRole('menuitem', { name: 'Combine commits', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')

      await row(page, 'Commit 3').click()
      await page.locator('.details-files').getByText('f3.txt', { exact: true }).click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Show file history', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Show all commits', exact: true })).toBeVisible()
      await openCommitMenu(page, 'Commit 3')
      await expect(page.getByRole('menuitem', { name: 'Combine commits: not available in a file’s history' })).toBeDisabled()
    } finally {
      removeDir(repo)
    }
  })

  test('is disabled with the reason shown when there is nothing to squash into or changes are uncommitted', async ({ open }) => {
    const repo = fourCommits()
    try {
      const page = await open(repo, 'history')
      await openCommitMenu(page, 'Commit 1')
      await expect(page.getByRole('menuitem', { name: 'Combine commits: there is no previous commit' })).toBeDisabled()
      await page.keyboard.press('Escape')

      write(repo, 'f1.txt', 'edited\n')
      await expect(page.locator('.commit-list')).toContainText('Working changes')
      await openCommitMenu(page, 'Commit 3')
      const item = page.getByRole('menuitem', { name: 'Combine commits: commit or stash your changes first' })
      await expect(item).toBeVisible()
      await expect(item).toBeDisabled()
    } finally {
      removeDir(repo)
    }
  })
})
