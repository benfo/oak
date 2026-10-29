import { expect, test } from './fixtures'
import { commitAll, write } from './repos'

test('History drops columns as the list narrows and never needs a sideways scrollbar', async ({ open, small }) => {
  write(small, 'a.txt', 'a\n')
  commitAll(small, 'Add a')
  const page = await open(small, 'history')
  const visible = (cls: string) => page.locator(`.commit-scroll .${cls}`).first().isVisible()
  await page.setViewportSize({ width: 1440, height: 800 })
  await expect.poll(() => visible('c-hash')).toBe(true)
  expect(await visible('c-date')).toBe(true)
  // A narrow list: the commit id goes first, then the date, then the author; the message always stays.
  await page.setViewportSize({ width: 960, height: 800 })
  for (let i = 0; i < 6; i++) await page.keyboard.press('Control+Equal')
  await expect.poll(() => visible('c-hash')).toBe(false)
  expect(await visible('subject-text')).toBe(true)
  expect(await page.locator('.commit-scroll').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
})

test('the commit details keep a usable height when the window is short, and the graph size returns when it grows', async ({
  open,
  small
}) => {
  const page = await open(small, 'history')
  // A graph that was dragged tall leaves the details almost nothing in a short window.
  await page.evaluate(() => localStorage.setItem('split:history', '640'))
  await page.reload()
  await page.getByRole('toolbar', { name: 'Repository actions' }).waitFor()
  await page.keyboard.press('Control+2')
  await page.setViewportSize({ width: 1200, height: 700 })
  const detailsHeight = () => page.locator('#history-rest').evaluate((el) => el.getBoundingClientRect().height)
  await expect.poll(detailsHeight).toBeGreaterThanOrEqual(278)
  const graphHeight = () => page.locator('#history-first').evaluate((el) => el.getBoundingClientRect().height)
  const squeezed = await graphHeight()
  await page.setViewportSize({ width: 1200, height: 1100 })
  await expect.poll(graphHeight).toBeGreaterThan(squeezed + 100)
})
