import { expect, test } from './fixtures'

test('Alt+Left and Alt+Right walk back and forward through view switches', async ({ open, small }) => {
  const page = await open(small)
  const app = page.locator('.app')
  const runCommand = async (name: string) => {
    await page.keyboard.press('Control+Shift+P')
    const palette = page.locator('.command-palette')
    const input = palette.getByRole('textbox', { name: 'Type a command…' })
    await expect(input).toBeFocused()
    await input.fill(name)
    await expect(palette.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter')
  }

  await expect(app).toHaveAttribute('data-workspace-view', 'changes')
  await runCommand('Go to History')
  await expect(app).toHaveAttribute('data-workspace-view', 'history')

  await runCommand('Go back')
  await expect(app).toHaveAttribute('data-workspace-view', 'changes')
  await page.keyboard.press('Alt+ArrowRight')
  await expect(app).toHaveAttribute('data-workspace-view', 'history')
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(app).toHaveAttribute('data-workspace-view', 'changes')

  // The fixture's Ctrl+1 left History first, so one more step back exists, then nothing.
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(app).toHaveAttribute('data-workspace-view', 'history')
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(page.locator('.status-message')).toContainText('Nothing earlier')
})
