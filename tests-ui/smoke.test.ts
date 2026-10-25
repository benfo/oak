import { expect, test } from './fixtures'
import { git } from './repos'

test.describe('changes and diff', () => {
  test('opens a repo and lists its changes', async ({ open, small }) => {
    const page = await open(small)
    await expect(page.getByRole('row', { name: /app\.ts/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /notes\.txt/ })).toBeVisible()
  })

  test('shows the diff of a selected file with syntax colours', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    await expect(page.locator('.dl.add').first()).toContainText('changed5')
    await expect(page.locator('.dl.add .code span[style*="color"]').first()).toBeVisible()
    await expect(page.getByLabel('Change 1 of 3')).toBeVisible()
  })

  test('stages and unstages a file with Enter', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    await page.keyboard.press('Enter')
    await expect.poll(() => git(small, 'diff', '--cached', '--name-only').trim()).toBe('src/app.ts')
    await expect(page.getByText('Stage files to include them in the next commit')).toHaveCount(0)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    await page.keyboard.press('Enter')
    await expect.poll(() => git(small, 'diff', '--cached', '--name-only').trim()).toBe('')
  })

  test('stages only the selected line', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    await expect(page.getByLabel('Change 1 of 3')).toBeVisible()
    await page.locator('.dl.del .gutter').first().click()
    await expect(page.getByText('1 line selected')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect.poll(() => git(small, 'diff', '--cached')).toContain('-const value5 = 5')
    const staged = git(small, 'diff', '--cached')
    expect(staged).not.toContain('+const changed5')
    expect(staged).not.toContain('changed60')
  })

  test('N and P move between hunks', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    await page.locator('.dl.add').first().click()
    await page.keyboard.press('n')
    await expect(page.getByLabel('Change 2 of 3')).toBeVisible()
    await page.keyboard.press('n')
    await expect(page.getByLabel('Change 3 of 3')).toBeVisible()
    await page.keyboard.press('p')
    await expect(page.getByLabel('Change 2 of 3')).toBeVisible()
  })

  test('switches between inline and side by side', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    await page.locator('.dl.add').first().click()
    const diff = page.locator('.changes-diff .diff')
    await expect(diff).not.toHaveClass(/side-mode/)
    await page.keyboard.press('Control+Shift+D')
    await expect(diff).toHaveClass(/side-mode/)
    await expect(diff.locator('.side-column')).toHaveCount(2)
    await page.keyboard.press('Control+Shift+D')
    await expect(diff).not.toHaveClass(/side-mode/)
  })
})

test.describe('history', () => {
  test('lists commits', async ({ open, small }) => {
    const page = await open(small, 'history')
    await expect(page.locator('.commit-list')).toContainText('Initial commit')
  })

  test('the commit menu groups rare actions into submenus', async ({ open, small }) => {
    const page = await open(small, 'history')
    await page
      .locator('.commit-list')
      .getByRole('option', { name: /Initial commit/ })
      .click({ button: 'right' })
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: /New branch from here/ })).toBeVisible()
    for (const group of ['Compare', 'Merge / Rebase', 'Undo', 'More', 'Copy']) {
      await expect(menu.getByRole('menuitem', { name: group })).toBeVisible()
    }
    await expect(menu.getByRole('menuitem', { name: /Revert commit/ })).toHaveCount(0)
    await menu.getByRole('menuitem', { name: 'Undo' }).click()
    await expect(page.getByRole('menuitem', { name: /Revert commit/ })).toBeVisible()
  })

  test('hides branches matching a pattern in the sidebar and the graph, and reveals them again', async ({ open, small }) => {
    git(small, 'stash', '-u', '-q')
    git(small, 'checkout', '-q', '-b', 'dependabot/npm/lodash')
    git(small, 'commit', '-q', '--allow-empty', '-m', 'Bump lodash')
    git(small, 'checkout', '-q', 'main')
    git(small, 'stash', 'pop', '-q')
    const page = await open(small, 'history')
    const list = page.locator('.commit-list')
    await expect(list).toContainText('Bump lodash')

    await page.getByRole('button', { name: 'Branch options' }).click()
    await page.getByRole('menuitem', { name: /More branch options/ }).click()
    await page.getByRole('textbox', { name: 'Branch name pattern' }).fill('dependabot/*')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Branches the pattern hides' })).toBeVisible()
    await page.getByRole('option', { name: /dependabot\/\*/ }).focus()
    await expect(page.getByRole('region', { name: 'Branches the pattern hides' })).toContainText('dependabot/npm/lodash')
    await page.keyboard.press('F2')
    await page.keyboard.type('dependabot/npm/*')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('option', { name: /dependabot\/npm\/\*/ })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(list).not.toContainText('Bump lodash')
    await expect(page.getByRole('treeitem', { name: /dependabot/ })).toHaveCount(0)

    await page.getByRole('button', { name: '1 hidden', exact: true }).click()
    await expect(list).toContainText('Bump lodash')
    await expect(page.getByRole('button', { name: 'Showing 1 hidden', exact: true })).toBeVisible()
  })

  test('hides remote branches without a local copy from the graph from the Branch options menu', async ({ open, small }) => {
    git(small, 'stash', '-u', '-q')
    git(small, 'checkout', '-q', '--detach', 'HEAD')
    git(small, 'commit', '-q', '--allow-empty', '-m', 'Teammate work')
    git(small, 'update-ref', 'refs/remotes/origin/teammate/wip', 'HEAD')
    git(small, 'checkout', '-q', 'main')
    git(small, 'stash', 'pop', '-q')
    const page = await open(small, 'history')
    const list = page.locator('.commit-list')
    await expect(list).toContainText('Teammate work')

    await page.getByRole('button', { name: 'Branch options' }).click()
    await page.getByRole('menuitem', { name: /Hide remote branches without a local copy/ }).click()
    await expect(list).not.toContainText('Teammate work')

    await page.getByRole('button', { name: '1 hidden', exact: true }).click()
    await expect(list).toContainText('Teammate work')
  })

  // TODO: re-add the 5,000 commit scroll test once it is stable.
})

test.describe('large diff', () => {
  test('renders a 60,000 line diff as a window and jumps between hunks', async ({ open, hugeDiff }) => {
    const page = await open(hugeDiff)
    await page.getByRole('row', { name: /big\.ts/ }).click()
    await expect(page.locator('.dl').first()).toBeVisible()
    expect(await page.locator('.dl').count()).toBeLessThan(400)
    await page.locator('.dl.add').first().click()
    await page.keyboard.press('n')
    await expect(page.getByLabel(/^Change 2 of /)).toBeVisible()
    await page.keyboard.press('End')
    await expect(page.locator('.dl.cursor')).toBeVisible()
  })
})

test.describe('blame', () => {
  test('opens from the file menu, keeps its place across views, and closes with Escape', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    const blame = page.locator('.blame-view .diff')
    await expect(blame).toBeFocused()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    await expect(page.locator('.blame-preview')).toContainText('Initial commit')
    await expect(page.locator('.blame-view')).toContainText('Not committed yet')

    await page.keyboard.press('n')
    await expect(page.locator('.blame-row.cursor.block-start')).toHaveCount(1)
    await page.keyboard.press('End')
    await expect(page.locator('.blame-row.cursor')).toBeVisible()

    await page.keyboard.press('Control+1')
    await expect(page.locator('.blame-view')).toBeHidden()
    await expect(page.locator('[role=grid]:focus, [role=grid] :focus').first()).toBeAttached()
    await page.keyboard.press('Control+3')
    await expect(page.locator('.blame-view')).toBeVisible()
    await expect(page.locator('.blame-row.cursor')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.blame-view')).toHaveCount(0)
  })

  test('Enter on a committed line shows its commit in History', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await expect(page.locator('.blame-view')).toBeHidden()
    await expect(page.locator('.commit-list')).toContainText('Initial commit')
    await page.keyboard.press('Control+3')
    await expect(page.locator('.blame-view')).toBeVisible()
  })

  test('Space shows the full commit message in a popover that Escape closes before the view', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    await page.keyboard.press('Home')
    await page.keyboard.press('Space')
    const popover = page.locator('.commit-popover')
    await expect(popover).toContainText('Initial commit')
    await expect(popover.locator('code')).toHaveText(/^[0-9a-f]{40}$/)
    await expect(page.locator('.blame-view .diff')).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(page.locator('.blame-view')).toBeVisible()

    await page.locator('.blame-preview-button').click()
    await expect(popover).toBeVisible()
    await expect(page.locator('.blame-view .diff')).toBeFocused()
    await page.keyboard.press('Control+1')
    await expect(popover).toHaveCount(0)

    await page.keyboard.press('Control+3')
    await expect(page.locator('.blame-row.cursor')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.blame-view')).toHaveCount(0)
  })
})

test.describe('layout', () => {
  test('F11 expands the code area and restores it', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    const files = page.getByRole('row', { name: /notes\.txt/ })
    await expect(files).toBeVisible()
    await page.keyboard.press('F11')
    await expect(files).toBeHidden()
    await page.keyboard.press('F11')
    await expect(files).toBeVisible()
  })
})
