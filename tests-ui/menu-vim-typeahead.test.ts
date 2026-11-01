import { expect, test } from './fixtures'
import { commitAll, initRepo, removeDir, tempDir, write } from './repos'

test('with Vim keys on, a menu still type-aheads words containing h/j/k/l and j alone still moves', async ({ open }) => {
  const repo = tempDir('vim-menu')
  initRepo(repo)
  for (const n of [1, 2, 3]) {
    write(repo, `f${n}.txt`, `${n}\n`)
    commitAll(repo, `Commit ${n}`)
  }
  try {
    const page = await open(repo, 'history')
    await page.evaluate(() => {
      localStorage.setItem('settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('settings') ?? '{}'), vimNavigation: true }))
    })
    await page.reload()
    await page.getByRole('toolbar', { name: 'Repository actions' }).waitFor()
    await page.keyboard.press('Control+2')
    await page
      .locator('.commit-list')
      .getByRole('option', { name: /Commit 2/ })
      .click()
    const focused = () => page.evaluate(() => document.activeElement?.textContent ?? '')
    const openMenu = async () => {
      await page.keyboard.press('Shift+F10')
      await expect.poll(focused).toMatch(/^Checkout this commit/)
    }

    await openMenu()
    for (const letter of 'cher') await page.keyboard.press(letter)
    await expect.poll(focused).toMatch(/^Cherry-pick/)
    await page.keyboard.press('Escape')

    await openMenu()
    await page.keyboard.press('j')
    await expect.poll(focused).toBe('New branch from here…')
  } finally {
    removeDir(repo)
  }
})
