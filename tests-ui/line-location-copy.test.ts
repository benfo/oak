import { test, expect } from './fixtures'

test('Ctrl+Shift+C copies the diff cursor location while Ctrl+C copies code', async ({ open, small }) => {
  const page = await open(small)
  await page
    .getByRole('row', { name: /app\.ts/ })
    .first()
    .click()
  const diff = page.locator('.changes-diff .diff')
  await diff.locator('.dl .gutter').first().click()
  await page.keyboard.press('Control+c')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('const value2 = 2')
  await page.keyboard.press('Control+Shift+c')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('src/app.ts:2')
})
