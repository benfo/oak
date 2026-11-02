import { expect, test } from './fixtures'

test('a hint goes to the status bar, not over the app', async ({ open, small }) => {
  const page = await open(small)
  const runCommand = async (name: string) => {
    await page.keyboard.press('Control+Shift+P')
    const palette = page.locator('.command-palette')
    const input = palette.getByRole('textbox', { name: 'Type a command…' })
    await expect(input).toBeFocused()
    await input.fill(name)
    await expect(palette.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter')
  }

  // "No blame is open" is a hint: it belongs in the bar, not over the app.
  await runCommand('Go to Blame')
  await expect(page.locator('.status-message')).toContainText('No blame is open')
  await expect(page.locator('.toast')).toHaveCount(0)
})

test('an error stays as a toast that screen readers announce, and a click dismisses it', async ({ open, small }) => {
  const page = await open(small)
  // The small repo has no remote, so pushing fails.
  await page.getByRole('button', { name: 'Push', exact: true }).click()
  const toast = page.locator('.toast.error')
  await expect(toast).toHaveAttribute('role', 'alert')
  await toast.click()
  await expect(toast).toHaveCount(0)
})
