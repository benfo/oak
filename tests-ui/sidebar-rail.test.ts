import { expect, test } from './fixtures'

test('the collapsed sidebar rail is reachable by keyboard and hands focus back to the main area', async ({ open, small }) => {
  const page = await open(small)
  await page.keyboard.press('Control+[')
  const rail = page.getByRole('toolbar', { name: 'Views' })
  await expect(rail).toBeVisible()
  await rail.getByRole('button', { name: 'Show sidebar' }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(rail.getByRole('button', { name: 'Changes' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(rail.getByRole('button', { name: 'History' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-workspace-view]')).toHaveAttribute('data-workspace-view', 'history')
  await expect(page.locator('.commit-list').getByRole('option').first()).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.commit-list')).toBeFocused()
})
