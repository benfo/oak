import { expect, test } from './fixtures'
import { git } from './repos'

for (const view of ['changes', 'history', 'blame'] as const) {
  test(`${view} toolbar Escape dismisses the tooltip, then returns to its own code pane`, async ({ open, small }) => {
    const page = await open(small, view === 'history' ? 'history' : 'changes')
    if (view === 'history') {
      await page
        .locator('.commit-list')
        .getByRole('option', { name: /Initial commit/ })
        .click()
      await page.locator('.details-files').getByText('app.ts', { exact: true }).click()
    } else {
      await page.getByRole('row', { name: /app\.ts/ }).click({ button: view === 'blame' ? 'right' : 'left' })
      if (view === 'blame') await page.getByRole('menuitem', { name: 'Show blame' }).click()
    }
    const container = page.locator(view === 'history' ? '.details-diff' : view === 'blame' ? '.blame-view' : '.changes-diff')
    const code = container.locator('.diff')
    await expect(code.locator(view === 'blame' ? '.blame-row' : '.dl').first()).toBeVisible()
    await code.focus()
    await page.keyboard.press('Tab')
    const buttons = container.getByRole('toolbar').locator('button:not(:disabled)')
    for (let i = 0; i < (await buttons.count()); i++) {
      const button = buttons.nth(i)
      // Enter the toolbar before choosing the target so its focus restoration
      // cannot redirect us. Refocus through a neighbour to reopen a dismissed tip.
      await buttons.first().focus()
      await buttons.nth(i === 0 ? 1 : 0).focus()
      await button.focus()
      await expect(button).toBeFocused()
      await expect(page.getByRole('tooltip')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('tooltip')).toHaveCount(0)
      await expect(button).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(code).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(code).toBeFocused()
    }
  })
}

test('toolbar buttons preserve app shortcuts and activation after their tooltip closes', async ({ open, small }) => {
  const page = await open(small)
  await expect(page.locator('.commit-list')).toBeAttached()
  for (const name of ['Preferences', 'More actions']) {
    await page.getByRole('row', { name: 'Changes', exact: true }).click()
    const button = page.getByRole('button', { name, exact: true })
    await page.locator('.tb-repo').focus()
    await button.focus()
    await expect(button).toBeFocused()
    await expect(page.getByRole('tooltip')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+2')
    await expect(page.locator('.commit-list')).toBeFocused()
  }
  const more = page.getByRole('button', { name: 'More actions', exact: true })
  await page.locator('.tb-repo').focus()
  await more.focus()
  await expect(more).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.locator('.menu-popover').locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(more).toBeFocused()
})

test('toolbar options close on Escape and restore their trigger before returning to a pane', async ({ open, small }) => {
  git(small, 'remote', 'add', 'origin', small)
  git(small, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  git(small, 'branch', '--set-upstream-to=origin/main', 'main')
  const page = await open(small)
  await page.getByRole('row', { name: /app\.ts/ }).click()
  await expect(page.locator('.changes-diff .dl').first()).toBeVisible()
  const cases = [
    [page.locator('.tb-repo'), '.palette.dropdown'],
    [page.locator('.tb-branch'), '.palette.dropdown'],
    [page.getByRole('button', { name: 'More actions', exact: true }), '.menu-popover'],
    [page.getByRole('button', { name: 'Pull options', exact: true }), '.menu-popover'],
    [page.getByRole('button', { name: /^Diff layout:/ }), '.menu-popover'],
    [page.getByRole('button', { name: 'Changes actions', exact: true }), '.menu-popover']
  ] as const
  for (const [button, selector] of cases) {
    await button.focus()
    await page.keyboard.press('Enter')
    const popup = page.locator(selector)
    await expect(popup).toBeVisible()
    await expect(popup.locator(':focus')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
    await expect(button).toBeFocused()
  }
  await page.keyboard.press('Control+2')
  await expect(page.locator('.commit-list')).toBeFocused()
  const scope = page.getByRole('button', { name: /^History scope:/ })
  await scope.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.menu-popover').locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(scope).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.commit-list')).toBeFocused()
})
