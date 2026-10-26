import { expect, test } from './fixtures'

test('command palette runs commands from the keyboard', async ({ open, small }) => {
  const page = await open(small)
  await page.keyboard.press('Control+Shift+P')
  const palette = page.locator('.command-palette')
  const input = palette.getByRole('textbox', { name: 'Type a command…' })
  await expect(input).toBeFocused()
  await palette.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })

  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 720 })
    await input.fill('')
    await input.fill('Preferences')
    await expect(palette.getByRole('option')).toHaveCount(1)
    const overflow = await palette.locator('.palette-row').evaluateAll((rows) => rows.some((row) => row.scrollWidth > row.clientWidth))
    expect(overflow).toBe(false)
    await input.fill('zzzz no matching command')
    await expect(palette.getByText('No matches', { exact: true })).toBeVisible()
  }

  await input.fill('View: Go to History')
  const option = palette.getByRole('option')
  await expect(option).toHaveCount(1)
  await expect(option.locator('.palette-label')).toHaveText('Go to History')
  await expect(option.locator('.palette-category')).toHaveText('View')
  await page.keyboard.press('ArrowDown')
  await expect(input).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(palette).toHaveCount(0)
  await expect(page.locator('.commit-list')).toBeFocused()
  await page.keyboard.press('Control+Shift+P')
  await expect(palette.getByRole('option').first()).toContainText('Go to History')
  await expect(palette.getByRole('option').first().locator('.palette-recent')).toHaveText('recent')
  await page.keyboard.press('Escape')
  await expect(palette).toHaveCount(0)
  await expect(page.locator('.commit-list')).toBeFocused()
})
