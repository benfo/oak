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
