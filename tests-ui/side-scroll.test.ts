import { expect, test } from './fixtures'
import { commitAll, write } from './repos'
import type { Page } from '@playwright/test'

const line = (n: number) => `const text = "${'x'.repeat(n)}"\n`

async function openSideBySide(page: Page) {
  await page.getByRole('button', { name: 'Diff options', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Side by side', exact: true }).click()
  if (await page.getByRole('menu', { name: 'Diff options', exact: true }).isVisible()) await page.keyboard.press('Escape')
}

test('the side-by-side columns scroll together sideways, and the shorter side stops at its own end', async ({ open, small }) => {
  write(small, 'long.ts', line(200))
  commitAll(small, 'Add long line')
  write(small, 'long.ts', line(700))
  const page = await open(small)
  await page.getByRole('row', { name: /long\.ts/ }).click()
  await openSideBySide(page)
  const oldSide = page.locator('.changes-diff .side-column[data-side="old"]')
  const newSide = page.locator('.changes-diff .side-column[data-side="new"]')
  const max = (side: typeof oldSide) => side.evaluate((el) => el.scrollWidth - el.clientWidth)
  const [oldMax, newMax] = [await max(oldSide), await max(newSide)]
  expect(newMax).toBeGreaterThan(oldMax + 100)
  const at = (side: typeof oldSide) => side.evaluate((el) => el.scrollLeft)

  await newSide.evaluate((el) => (el.scrollLeft = el.scrollWidth))
  const longEnd = await at(newSide)
  // The short side follows as far as it can go, which is its own end (a little under scrollWidth - clientWidth, which varies).
  await expect.poll(() => at(oldSide)).toBeGreaterThan(oldMax - 30)
  expect(await at(oldSide)).toBeLessThanOrEqual(oldMax)
  // It reaching its end must not pull the long side back.
  await page.waitForTimeout(150)
  expect(await at(newSide)).toBe(longEnd)

  await oldSide.evaluate((el) => (el.scrollLeft = 0))
  await expect.poll(() => at(newSide)).toBe(0)
})
