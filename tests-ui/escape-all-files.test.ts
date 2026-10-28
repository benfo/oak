import { expect, test } from './fixtures'

test('Escape exits focus mode while the All files tree has focus', async ({ open, small }) => {
  const page = await open(small, 'history')
  await page
    .locator('.commit-list')
    .getByRole('option', { name: /Initial commit/ })
    .click()
  await page.keyboard.press('F11')
  const layout = page.locator('[data-workspace-layout]')
  await expect(layout).toHaveAttribute('data-workspace-layout', 'code')
  await page.locator('.details-files').getByText('app.ts', { exact: true }).click()
  await page.keyboard.press('t')
  await expect(page.getByRole('treegrid', { name: 'Files in this commit' })).toBeVisible()
  await expect(page.locator('.details-files [role=row]:focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(layout).toHaveAttribute('data-workspace-layout', 'standard')
})
