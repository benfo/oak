import { expect, test } from './fixtures'

test('entering focus mode from the Changes file list keeps focus there', async ({ open, small }) => {
  const page = await open(small)
  const file = page.getByRole('row', { name: /app\.ts/ })
  await file.click()
  await expect(file).toBeFocused()
  await page.keyboard.press('F11')
  await expect(page.locator('[data-workspace-layout]')).toHaveAttribute('data-workspace-layout', 'code')
  await expect(file).toBeVisible()
  await expect(file).toBeFocused()
})

test('entering focus mode from the commit files list keeps focus there; from the graph it moves to the code', async ({ open, small }) => {
  const page = await open(small, 'history')
  const graph = page.locator('.commit-list')
  await graph.getByRole('option', { name: /Initial commit/ }).click()
  await page.locator('.details-files').getByText('app.ts', { exact: true }).click()
  await page.keyboard.press('F11')
  await expect(page.locator('[data-workspace-layout]')).toHaveAttribute('data-workspace-layout', 'code')
  await expect(page.locator('.details-files')).toBeFocused()
  await page.keyboard.press('F11')
  await graph.focus()
  await expect(graph).toBeFocused()
  await page.keyboard.press('F11')
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.details-diff'))).toBe(true)
})
