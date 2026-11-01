import { expect, test } from './fixtures'
import { manyRefsRepo, removeDir, tempDir } from './repos'

/** A commit can carry thousands of refs; its row and its menu must stay small and fast. */
test('a commit with many refs keeps few badges and a short menu', async ({ open }) => {
  const dir = tempDir('manyrefs')
  manyRefsRepo(dir, 300)
  try {
    const page = await open(dir, 'history')
    const row = page.locator('.commit-list').getByRole('option', { name: /Initial commit/ })
    await expect(row).toBeVisible()
    expect(await row.locator('.ref-badge').count()).toBeLessThanOrEqual(8)
    await expect(row.locator('.ref-badge', { hasText: /^\+\d+$/ })).toBeVisible()

    await row.click({ button: 'right' })
    await expect(page.locator('.menu-popover')).toBeVisible()
    expect(await page.locator('.menu-popover [role=menuitem]').count()).toBeLessThan(20)
    await page.getByRole('menuitem', { name: 'Checkout' }).hover()
    await expect(page.getByRole('menuitem', { name: /more branches not listed/ })).toBeVisible()
    expect(await page.locator('.menu-popover [role=menuitem]').count()).toBeLessThan(40)
  } finally {
    removeDir(dir)
  }
})
