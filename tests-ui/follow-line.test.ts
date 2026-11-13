import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { git, initRepo, removeDir, tempDir, write } from './repos'

/** main and feature commits alternate by date, so the graph interleaves them: Main 2, Feature 2, Main 1, Feature 1, Base. */
function interleaved() {
  const dir = tempDir('follow')
  initRepo(dir)
  let time = 1_700_000_000
  const commit = (message: string) => {
    write(dir, `${message}.txt`, `${message}\n`)
    git(dir, 'add', '-A')
    const date = `${time++} +0000`
    execFileSync('git', ['commit', '-q', '-m', message], {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Oak Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Oak Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date
      }
    })
  }
  commit('Base')
  git(dir, 'branch', 'feature')
  for (const n of [1, 2]) {
    git(dir, 'checkout', '-q', 'feature')
    commit(`Feature ${n}`)
    git(dir, 'checkout', '-q', 'main')
    commit(`Main ${n}`)
  }
  return dir
}

const selected = (page: Page) => page.locator('.commit-list [role=option][aria-selected=true] .subject-text')
const row = (page: Page, subject: string) => page.locator('.commit-list').getByRole('option', { name: new RegExp(subject) })

test('Alt+Down and Alt+Up step along the selected line, skipping commits from other branches', async ({ open }) => {
  const repo = interleaved()
  try {
    const page = await open(repo, 'history')
    await row(page, 'Main 2').click()
    await page.keyboard.press('Alt+ArrowDown')
    await expect(selected(page)).toHaveText('Main 1')
    await page.keyboard.press('Alt+ArrowDown')
    await expect(selected(page)).toHaveText('Base')
    await page.keyboard.press('Alt+ArrowUp')
    await expect(selected(page)).toHaveText('Main 1', { message: 'the checked-out line wins at a fork' })

    await row(page, 'Feature 1').click()
    await page.keyboard.press('Alt+ArrowUp')
    await expect(selected(page)).toHaveText('Feature 2')
    await page.keyboard.press('ArrowDown')
    await expect(selected(page)).toHaveText('Main 1', { message: 'plain arrows still move one row' })
  } finally {
    removeDir(repo)
  }
})

test('Alt+Up retraces a walk down, back onto the branch it started on', async ({ open }) => {
  const repo = interleaved()
  try {
    const page = await open(repo, 'history')
    await row(page, 'Feature 2').click()
    await page.keyboard.press('Alt+ArrowDown')
    await page.keyboard.press('Alt+ArrowDown')
    await expect(selected(page)).toHaveText('Base')
    await page.keyboard.press('Alt+ArrowUp')
    await expect(selected(page)).toHaveText('Feature 1', { message: 'the walk down wins over the checked-out line' })
    await page.keyboard.press('Alt+ArrowUp')
    await expect(selected(page)).toHaveText('Feature 2')
  } finally {
    removeDir(repo)
  }
})

test('the commit details link the parent and the child on the line', async ({ open }) => {
  const repo = interleaved()
  try {
    const page = await open(repo, 'history')
    await row(page, 'Main 1').click()
    const main2 = git(repo, 'rev-parse', 'main').trim().slice(0, 8)
    await page.locator('.hash-line').getByRole('button', { name: main2 }).click()
    await expect(selected(page)).toHaveText('Main 2')
  } finally {
    removeDir(repo)
  }
})
