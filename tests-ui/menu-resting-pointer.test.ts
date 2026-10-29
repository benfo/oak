import { expect, test } from './fixtures'

/** The menu a keyboard opens must stay keyboard-driven even when the mouse rests where an item or submenu appears. */
test('a keyboard-opened menu ignores a pointer resting over any of its rows', async ({ open, small }) => {
  const page = await open(small, 'history')
  const row = page.locator('.commit-list').getByRole('option', { name: /Initial commit/ })
  await row.click()
  const focusedLabel = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
  const menus = () => page.locator('.menu-popover').count()

  // Measure where each item lands relative to the menu's top-left, then rest the pointer on it and reopen.
  await page.keyboard.press('Shift+F10')
  const items = page.locator('.menu-popover').first().locator('[role=menuitem]')
  await expect(items.first()).toBeVisible()
  const menuBox = (await page.locator('.menu-popover').first().boundingBox())!
  const centres: { label: string; dx: number; dy: number }[] = []
  for (let i = 0; i < (await items.count()); i++) {
    const b = (await items.nth(i).boundingBox())!
    centres.push({ label: (await items.nth(i).textContent())!.trim(), dx: b.x + b.width / 2 - menuBox.x, dy: b.y + b.height / 2 - menuBox.y })
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('.menu-popover')).toHaveCount(0)

  const failures: string[] = []
  for (const c of centres) {
    await row.focus()
    await page.mouse.move(menuBox.x + c.dx, menuBox.y + c.dy)
    await page.keyboard.press('Shift+F10')
    await expect(page.locator('.menu-popover').first()).toBeVisible()
    await page.waitForTimeout(400)
    const first = await focusedLabel()
    const opened = await menus()
    await page.keyboard.press('ArrowDown')
    const second = await focusedLabel()
    await page.keyboard.press('ArrowDown')
    const third = await focusedLabel()
    console.log(JSON.stringify({ restingOn: c.label, first, second, third, menus: opened }))
    if (opened !== 1 || second === first || third === second) failures.push(c.label)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.menu-popover')).toHaveCount(0)
  }
  expect(failures).toEqual([])
})

test('moving the mouse lifts the lock, and a right-click menu is never locked', async ({ open, small }) => {
  const page = await open(small, 'history')
  const row = page.locator('.commit-list').getByRole('option', { name: /Initial commit/ })
  const locked = () => page.evaluate(() => document.documentElement.hasAttribute('data-menu-hover-lock'))

  await row.click()
  await page.keyboard.press('Shift+F10')
  await expect(page.locator('.menu-popover')).toBeVisible()
  expect(await locked()).toBe(true)
  // Moving onto a submenu row now behaves as before: it opens on hover.
  const compare = page.getByRole('menuitem', { name: 'Compare' })
  const b = (await compare.boundingBox())!
  await page.mouse.move(b.x - 40, b.y + b.height / 2)
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 })
  expect(await locked()).toBe(false)
  await expect(page.getByRole('menuitem', { name: 'Compare commit with…' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(page.locator('.menu-popover')).toHaveCount(0)

  await row.click({ button: 'right' })
  await expect(page.locator('.menu-popover')).toBeVisible()
  expect(await locked()).toBe(false)
})
