import { expect, test } from './fixtures'
import { commitAll, write } from './repos'
import type { Page } from '@playwright/test'

/** Scrollers that show a scrollbar while an ancestor also shows one on the same axis: two bars stacked on one edge. */
async function stackedScrollers(page: Page) {
  return page.evaluate(() => {
    const scrolls = (el: HTMLElement, axis: 'X' | 'Y') => {
      const overflow = getComputedStyle(el)[`overflow${axis}` as 'overflowX']
      if (!/(auto|scroll)/.test(overflow)) return false
      return axis === 'X' ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1
    }
    const found: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      for (const axis of ['X', 'Y'] as const) {
        if (!scrolls(el, axis)) continue
        for (let up = el.parentElement; up; up = up.parentElement) {
          if (scrolls(up, axis)) found.push(`${axis}: ${el.className} inside ${up.className}`)
        }
      }
    }
    return found
  })
}

for (const [width, zoomSteps] of [
  [1440, 0],
  [960, 6]
] as const) {
  test(`no scroller sits inside another on the same axis (${width}px window, ${zoomSteps} zoom steps)`, async ({ open, small }) => {
    write(small, 'src/app.ts', 'const a = 1\n')
    commitAll(small, 'Add app')
    write(small, 'src/app.ts', 'const a = 2\n')
    const page = await open(small)
    await page.setViewportSize({ width, height: 720 })
    for (let i = 0; i < zoomSteps; i++) await page.keyboard.press('Control+Equal')
    await page.getByRole('row', { name: /app\.ts/ }).click()
    await expect(page.locator('.changes-diff .dl').first()).toBeVisible()
    expect(await stackedScrollers(page)).toEqual([])
    await page.keyboard.press('Control+2')
    await page
      .locator('.commit-list')
      .getByRole('option', { name: /Add app/ })
      .click()
    await expect(page.locator('.commit-scroll')).toBeVisible()
    expect(await stackedScrollers(page)).toEqual([])
  })
}
