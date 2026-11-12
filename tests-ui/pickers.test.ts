import { expect, test } from './fixtures'
import { git, write } from './repos'
import type { Locator, Page } from '@playwright/test'

async function settle(picker: Locator) {
  await picker.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
}

async function openThemes(page: Page) {
  await page.keyboard.press('Control+Shift+P')
  await page.locator('.palette-input').fill('Choose theme')
  await page.getByRole('option').filter({ hasText: 'Choose theme' }).click()
  const input = page.getByRole('textbox', { name: /Choose a theme/ })
  await expect(input).toBeFocused()
  await settle(page.locator('.palette'))
  return input
}

test('theme picker keeps its search box in place while searching and previews, reverts and accepts themes', async ({ open, small }) => {
  const page = await open(small)
  const original = await page.locator('html').getAttribute('data-theme')
  const saved = await page.evaluate(() => localStorage.getItem('theme'))
  let input = await openThemes(page)
  const picker = page.locator('.palette')
  const inputTop = (await input.boundingBox())!.y
  await input.fill('Dark')
  await expect(picker.getByRole('option', { name: 'Dark', exact: true })).toBeVisible()
  await settle(picker)
  expect((await input.boundingBox())!.y).toBe(inputTop)
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(saved)
  await input.fill('zzzz no theme')
  await expect(picker.getByText('No matches', { exact: true })).toBeVisible()
  await settle(picker)
  expect((await input.boundingBox())!.y).toBe(inputTop)
  await page.keyboard.press('Escape')
  await expect(picker).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('data-theme', original!)

  input = await openThemes(page)
  await input.fill('Dracula')
  await expect(picker.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(picker).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dracula')
})

test('a glowing theme lights up syntax-coloured code only while it is shown', async ({ open, small }) => {
  write(small, 'src/app.ts', "export const greeting = 'hello'\n")
  const page = await open(small)
  await page.getByRole('row', { name: /app\.ts/ }).click()
  const token = page.locator('.changes-diff .diff .syntax').first()
  const glow = () => token.evaluate((span) => getComputedStyle(span).textShadow)
  await expect(token).toBeVisible()
  expect(await glow()).toBe('none')

  let input = await openThemes(page)
  await input.fill("SynthWave '84")
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('html')).toHaveAttribute('data-glow')
  expect(await glow()).not.toBe('none')
  await page.keyboard.press('Escape')
  await expect(page.locator('html')).not.toHaveAttribute('data-glow')

  input = await openThemes(page)
  await input.fill("SynthWave '84")
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-glow')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('synthwave-84')
  input = await openThemes(page)
  await input.fill('Dracula')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).not.toHaveAttribute('data-glow')
  expect(await glow()).toBe('none')
})

test('branch and repository pickers keep current markers and size results to matches', async ({ open, small }) => {
  git(small, 'branch', 'feature/long-branch-name-for-picker-layout')
  git(small, 'checkout', '-q', 'feature/long-branch-name-for-picker-layout')
  git(small, 'checkout', '-q', 'main')
  const page = await open(small)
  await page.setViewportSize({ width: 800, height: 720 })
  await expect(page.getByRole('row', { name: 'feature/long-branch-name-for-picker-layout', exact: true }).first()).toBeVisible()
  for (const trigger of ['.tb-branch', '.tb-repo']) {
    await page.locator(trigger).click()
    const picker = page.locator('.palette.dropdown')
    const input = picker.getByRole('textbox')
    await expect(input).toBeFocused()
    await settle(picker)
    await expect(picker.locator('.palette-check .icon')).toHaveCount(1)
    if (trigger === '.tb-branch') {
      await expect(picker.locator('.palette-group').filter({ hasText: 'Recently used' })).toBeVisible()
      const clipped = await picker.locator('.palette-list').evaluate((list) => list.scrollHeight > list.clientHeight)
      expect(clipped).toBe(false)
    }
    const bounds = await picker.boundingBox()
    const overflow = await picker.locator('.palette-row').evaluateAll((rows) => rows.some((row) => row.scrollWidth > row.clientWidth))
    expect(overflow).toBe(false)
    await input.fill('zzzz-no-matching-item')
    if (trigger === '.tb-branch') {
      await expect(picker.getByRole('option')).toContainText('zzzz-no-matching-item')
    } else {
      await expect(picker.getByText('No matches', { exact: true })).toBeVisible()
    }
    await settle(picker)
    if (trigger === '.tb-branch') await expect.poll(async () => (await picker.boundingBox())!.height).toBeLessThan(bounds!.height)
    await page.keyboard.press('Escape')
    await expect(picker).toHaveCount(0)
    await expect(page.locator(trigger)).toBeFocused()
  }
})
