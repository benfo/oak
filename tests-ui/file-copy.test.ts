import { test, expect } from './fixtures'
import { join } from 'node:path'
import { realpathSync } from 'node:fs'

test('file list copy uses file paths after visiting the diff', async ({ open, small }) => {
  const page = await open(small)
  const file = page.getByRole('row', { name: /app\.ts/ }).first()
  await file.click()
  const diff = page.locator('.changes-diff .diff')
  await expect(diff).toBeVisible()
  await diff.locator('.dl .gutter').first().click()
  await page.keyboard.press('Control+c')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^const /)

  await file.focus()
  await page.keyboard.press('Control+c')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('src/app.ts')
  await page.keyboard.press('Control+Shift+c')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(join(realpathSync.native(small), 'src', 'app.ts'))
})
