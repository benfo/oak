import { expect, test } from './fixtures'
import { git } from './repos'

test('right-clicking a ref badge opens its menu and marks the badge until it closes', async ({ open, small }) => {
  git(small, 'add', '-A')
  git(small, 'commit', '-m', 'Commit for refs')
  git(small, 'branch', 'feature')
  git(small, 'tag', 'v1')
  const page = await open(small, 'history')
  for (const badge of ['.ref-badge.local:not(.current)', '.ref-badge.tag', '.ref-badge.current']) {
    const el = page.locator(badge).first()
    await el.click({ button: 'right' })
    await expect(page.locator('.menu-popover')).toBeVisible()
    await expect(el).toHaveAttribute('data-menu-open', '')
    expect(await el.evaluate((n) => getComputedStyle(n).boxShadow)).not.toBe('none')
    await page.keyboard.press('Escape')
    await expect(page.locator('.menu-popover')).toHaveCount(0)
    await expect(el).not.toHaveAttribute('data-menu-open')
  }
})

test("Shift+Menu opens the menu of the active commit's ref, a picker for several, the commit menu for none", async ({ open, small }) => {
  git(small, 'add', '-A')
  git(small, 'commit', '-m', 'Plain commit')
  git(small, 'commit', '--allow-empty', '-m', 'Tagged commit')
  git(small, 'tag', 'old')
  git(small, 'commit', '--allow-empty', '-m', 'Commit for refs')
  git(small, 'branch', 'feature')
  git(small, 'tag', 'v1')
  const page = await open(small, 'history')
  const menu = page.locator('.menu-popover')
  const row = (subject: string) => page.locator('.commit-row, [role=option]').filter({ hasText: subject }).first()

  // One ref: its menu opens directly, anchored to the badge, which shows as active.
  await row('Tagged commit').click()
  await page.keyboard.press('Shift+ContextMenu')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Checkout (detached)' })).toBeVisible()
  await expect(page.locator('.ref-badge.tag', { hasText: 'old' })).toHaveAttribute('data-menu-open', '')
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  // Several refs: a picker first, then the chosen ref's menu.
  await row('Commit for refs').click()
  await page.keyboard.press('Shift+ContextMenu')
  const picker = page.locator('.palette')
  await expect(picker).toBeVisible()
  await expect(menu).toHaveCount(0)
  await picker.getByRole('option', { name: /feature/ }).click()
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Checkout' }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  // No ref: the commit menu.
  await row('Plain commit').click()
  await page.keyboard.press('Shift+ContextMenu')
  await expect(menu.getByRole('menuitem', { name: /Cherry-pick/ })).toBeVisible()
})
