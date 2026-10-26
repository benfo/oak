import { expect, test } from './fixtures'
import { numberedLines, write } from './repos'

for (const view of ['inline', 'split', 'blame'] as const) {
  test(`find reveals distant occurrences horizontally in ${view}`, async ({ open, small }) => {
    const long = `const nearHit = '${'x'.repeat(2000)} farHit ${'y'.repeat(2000)} farHit'`
    write(small, 'src/app.ts', numberedLines(6000, (n) => n === 5500 ? long : null))
    const page = await open(small)
    const file = page.getByRole('row', { name: /app\.ts/ })
    if (view === 'blame') {
      await file.click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Show blame' }).click()
    } else {
      await file.click()
    }
    const pane = page.locator(view === 'blame' ? '.blame-view .diff' : '.changes-diff .diff')
    await expect(pane.locator('.dl').first()).toBeVisible()
    await pane.focus()
    if (view === 'split') {
      await page.keyboard.press('Control+Shift+D')
      await expect(pane).toHaveClass(/side-mode/)
    }
    await page.keyboard.press('Control+f')
    const input = page.getByRole('textbox', { name: 'Find in file' })
    await input.fill('farHit')
    await expect(page.locator('.find-bar-status')).toHaveText('1 of 2')
    const visibleMatch = async () => {
      await expect.poll(() => pane.evaluate((root) => {
        const hits = [...root.querySelectorAll<HTMLElement>('.find-hit.current')]
        if (!hits.length) return false
        const scroller = hits[0].closest('.side-column') ?? root
        const bounds = scroller.getBoundingClientRect()
        const gutter = hits[0].closest('.dl')?.querySelector('.gutter')?.getBoundingClientRect()
        const left = Math.max(bounds.left, gutter?.right ?? bounds.left)
        return hits.every((hit) => {
          const box = hit.getBoundingClientRect()
          return box.left >= left && box.right <= bounds.left + scroller.clientLeft + scroller.clientWidth && box.top >= bounds.top && box.bottom <= bounds.bottom
        })
      })).toBe(true)
      await expect(input).toBeFocused()
    }
    await visibleMatch()
    await page.keyboard.press('Enter')
    await expect(page.locator('.find-bar-status')).toHaveText('2 of 2')
    await visibleMatch()
    await page.keyboard.press('Shift+Enter')
    await expect(page.locator('.find-bar-status')).toHaveText('1 of 2')
    await visibleMatch()
    await input.fill('nearHit')
    await visibleMatch()
    await pane.evaluate((root) => {
      const hit = root.querySelector('.find-hit.current')!
      const scroller = hit.closest('.side-column') ?? root
      scroller.scrollLeft = scroller.scrollWidth
    })
    // A single match can be revealed again after manual scrolling, even though its index stays 0.
    await page.keyboard.press('Enter')
    await visibleMatch()
    if (view === 'split') {
      expect(await pane.locator('.side-column[data-side="old"]').evaluate((el) => el.scrollLeft)).toBe(0)
    }
  })
}
