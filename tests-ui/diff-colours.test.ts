import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { commitAll, write } from './repos'

const BLUE = ['rgb(5, 80, 174)', 'rgb(121, 192, 255)']
const ORANGE = ['rgb(149, 56, 0)', 'rgb(255, 166, 87)']

async function command(page: Page, name: string, pick = name) {
  await page.keyboard.press('Control+Shift+P')
  await page.locator('.palette-input').fill(name)
  await page.getByRole('option').filter({ hasText: pick }).first().click()
}

const colourOf = (page: Page, selector: string) =>
  page
    .locator(`.changes-diff .diff ${selector}`)
    .first()
    .evaluate((el) => getComputedStyle(el).color)

test('colour-blind friendly diff colours underline changed words but not changed indentation', async ({ open, small }) => {
  write(small, 'src/indent.ts', 'first\ncall(1)\nlast\n')
  commitAll(small, 'Add indent.ts')
  write(small, 'src/indent.ts', 'first\n    call(2)\nlast\n')
  const page = await open(small)
  await page.getByRole('row', { name: /indent\.ts/ }).click()
  await command(page, 'Switch diff colours')
  const added = page.locator('.changes-diff .diff .dl.add')
  const underline = (selector: string) =>
    added
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).textDecorationLine)
  await expect(added.locator('.word-change.blank')).toHaveCount(1)
  expect(await underline('.word-change.blank')).toBe('none')
  expect(await underline('.word-change:not(.blank)')).toBe('underline')
})

test('colour-blind friendly diff colours swap red and green for blue and orange, over any theme, and back', async ({ open, small }) => {
  const page = await open(small)
  await page.getByRole('row', { name: /app\.ts/ }).click()
  await expect(page.locator('.changes-diff .diff .dl.add').first()).toBeVisible()
  const standard = await colourOf(page, '.dl.add .sign')

  await command(page, 'Switch diff colours')
  await expect(page.locator('.status-bar')).toContainText('Colour-blind friendly')
  expect(BLUE).toContain(await colourOf(page, '.dl.add .sign'))
  expect(ORANGE).toContain(await colourOf(page, '.dl.del .sign'))

  // A theme with its own red and green still shows blue and orange.
  await command(page, 'Choose theme')
  await page.locator('.palette-input').fill('Dracula')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await colourOf(page, '.dl.add .sign')).toBe(BLUE[1])

  await command(page, 'Switch diff colours')
  await expect(page.locator('.status-bar')).toContainText('Standard')
  expect(BLUE).not.toContain(await colourOf(page, '.dl.add .sign'))
  await command(page, 'Choose theme')
  await page.locator('.palette-input').fill('System')
  await page.keyboard.press('Enter')
  await expect.poll(() => colourOf(page, '.dl.add .sign')).toBe(standard)
})
