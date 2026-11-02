import { expect, test } from './fixtures'

test('zoom shows in the status bar only off 100%, opens a bubble on change, and Escape closes it first', async ({ open, small }) => {
  const page = await open(small)
  const item = page.locator('.status-bar').getByRole('button', { name: /^Zoom \d+%$/ })
  const bubble = page.getByRole('group', { name: 'Zoom' })
  await expect(item).toHaveCount(0)

  await page.keyboard.press('Control+Equal')
  await expect(item).toHaveText('110%')
  await expect(bubble).toBeVisible()
  await expect(bubble).toContainText('110%')
  // It floats above the item, fully inside the window.
  const fits = await bubble.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight
  })
  expect(fits).toBe(true)

  // The bubble's own buttons step the same levels as the keys, and keep it open.
  await bubble.getByRole('button', { name: 'Zoom in' }).click()
  await expect(item).toHaveText('125%')
  await expect(bubble).toBeVisible()

  // Escape closes the bubble before anything else (here, expanded Code) reacts; the item stays.
  await page.mouse.move(5, 400)
  await page.keyboard.press('F11')
  await expect(page.locator('.app')).toHaveAttribute('data-workspace-layout', 'code')
  await bubble.waitFor({ state: 'visible' }).catch(() => {})
  await page.keyboard.press('Control+Equal')
  await expect(bubble).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(bubble).toHaveCount(0)
  await expect(page.locator('.app')).toHaveAttribute('data-workspace-layout', 'code')
  await expect(item).toBeVisible()

  // Left alone, it closes by itself; clicking the item brings it back.
  await page.keyboard.press('Control+Minus')
  await expect(bubble).toBeVisible()
  await expect(bubble).toHaveCount(0, { timeout: 6000 })
  await item.click()
  await expect(bubble).toBeVisible()

  await bubble.getByRole('button', { name: /^Reset/ }).click()
  await expect(item).toHaveCount(0)
  // The bubble stays to show 100%, then closes by itself.
  await expect(bubble).toContainText('100%')
  await page.mouse.move(5, 400)
  await expect(bubble).toHaveCount(0, { timeout: 6000 })
})

test('the zoom bubble keeps its place and size at every level, so + and - can be clicked repeatedly', async ({ open, small }) => {
  const page = await open(small)
  await page.keyboard.press('Control+Equal')
  const bubble = page.getByRole('group', { name: 'Zoom' })
  await expect(bubble).toContainText('110%')

  /** Each control's centre and size in real pixels: page lengths multiplied by the window zoom. */
  const physical = () =>
    bubble.evaluate((el) => {
      const z = Number(getComputedStyle(document.documentElement).getPropertyValue('--zoom'))
      return [...el.querySelectorAll('button, strong')].map((e) => {
        const r = e.getBoundingClientRect()
        return [((r.left + r.right) / 2) * z, ((r.top + r.bottom) / 2) * z, r.width * z, r.height * z]
      })
    })
  const before = await physical()

  // Up to the largest level and down to the smallest, passing 100% (where the text drops a digit) and both disabled ends.
  const route: [string, string][] = [
    ['Zoom in', '125%'],
    ['Zoom in', '150%'],
    ['Zoom out', '125%'],
    ['Zoom out', '110%'],
    ['Zoom out', '100%'],
    ['Zoom out', '90%'],
    ['Zoom out', '80%']
  ]
  for (const [button, level] of route) {
    await bubble.getByRole('button', { name: button }).click()
    await expect(bubble).toContainText(level)
    const after = await physical()
    after.forEach((box, i) =>
      box.forEach((n, k) => expect(Math.abs(n - before[i][k]), `control ${i} value ${k} at ${level}`).toBeLessThan(0.75))
    )
  }
})

test('stepping down through 100% with the bubble does not close it', async ({ open, small }) => {
  const page = await open(small)
  await page.keyboard.press('Control+Equal')
  const bubble = page.getByRole('group', { name: 'Zoom' })
  await expect(bubble).toContainText('110%')
  for (const level of ['100%', '90%', '80%']) {
    await bubble.getByRole('button', { name: 'Zoom out' }).click()
    await expect(bubble).toContainText(level)
  }
  await expect(bubble.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
})
