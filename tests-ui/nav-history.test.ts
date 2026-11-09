import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

async function runCommand(page: Page, name: string, pick?: string) {
  await page.keyboard.press('Control+Shift+P')
  const palette = page.locator('.command-palette')
  const input = palette.getByRole('textbox', { name: 'Type a command…' })
  await expect(input).toBeFocused()
  await input.fill(name)
  await expect(palette.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  if (!pick) return
  const picker = page.getByRole('textbox', { name: 'Blame file…' })
  await expect(picker).toBeFocused()
  await picker.fill(pick)
  await expect(page.getByRole('option', { name: pick })).toBeVisible()
  await page.keyboard.press('Enter')
}

test('Alt+Left and Alt+Right walk back and forward through view switches', async ({ open, small }) => {
  const page = await open(small)
  const app = page.locator('.app')

  await expect(app).toHaveAttribute('data-workspace-view', 'changes')
  await runCommand(page, 'Go to History')
  await expect(app).toHaveAttribute('data-workspace-view', 'history')

  await runCommand(page, 'Go back')
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

test('Alt+Left works while a button inside a file row has focus', async ({ open, small }) => {
  const page = await open(small)
  const app = page.locator('.app')
  const rowButton = page.locator('.file-section [role="row"] button.icon-btn').first()

  await expect(app).toHaveAttribute('data-workspace-view', 'changes')
  await rowButton.focus()
  await expect(rowButton).toBeFocused()
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(app).toHaveAttribute('data-workspace-view', 'history')
})

test('Back to a blame returns to the line the cursor was on', async ({ open, small }) => {
  const page = await open(small)
  const app = page.locator('.app')
  const rows = page.locator('.blame-view .blame-row')
  const cursorRow = page.locator('.blame-view .blame-row.cursor')

  await runCommand(page, 'Blame file…', 'app.ts')
  await expect(app).toHaveAttribute('data-workspace-view', 'blame')
  await expect(cursorRow).toHaveCount(1)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  const before = await cursorRow.innerText()

  await runCommand(page, 'Blame file…', 'README.md')
  await expect(rows.first()).toContainText('Demo')
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(rows.first()).not.toContainText('Demo')
  await expect(cursorRow).toHaveCount(1)
  expect(await cursorRow.innerText()).toBe(before)
})
