import { expect, test } from './fixtures'
import { git, numberedLines, write } from './repos'

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
    for (const group of ['Compare', 'Merge / Rebase', 'Undo', 'Copy']) {
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
  test('opens from the file menu, keeps its place across views, and closes only with the Close button', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    const blame = page.locator('.blame-view .diff')
    await expect(blame).toBeFocused()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    await expect(page.locator('.blame-preview')).toContainText('Initial commit')
    await expect(page.locator('.blame-view')).toContainText('Not committed yet')
    await expect(page.locator('.blame-row .code span[style*="color"]').first()).toBeVisible()

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

    // Escape never leaves Blame; only the Close button does.
    await page.keyboard.press('Escape')
    await expect(page.locator('.blame-view')).toBeVisible()
    await page.getByRole('toolbar', { name: 'Blame tools' }).getByRole('button', { name: 'Close blame' }).click()
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

  test('double-clicking the blame column shows the commit in History, and the code keeps word selection', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()

    await page.locator('.blame-row .code').nth(1).dblclick()
    await expect(page.locator('.blame-view')).toBeVisible()
    expect(await page.evaluate(() => window.getSelection()?.toString())).toContain('value2')

    await page.locator('.blame-row .gutter').nth(1).dblclick()
    await expect(page.locator('.blame-view')).toBeHidden()
    await expect(page.locator('.commit-list')).toContainText('Initial commit')
  })

  test('the sidebar Blame row has a close button that leaves the showing view alone', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    const nav = page.getByRole('treegrid', { name: 'Repository navigation' })
    await expect(nav.getByRole('row', { name: /Blame/ })).toBeVisible()

    // Closed from another view, Blame goes away and that view stays.
    await page.keyboard.press('Control+2')
    await expect(page.locator('.commit-list')).toBeVisible()
    await nav.getByRole('button', { name: 'Close blame' }).click({ force: true })
    await expect(nav.getByRole('row', { name: /Blame/ })).toHaveCount(0)
    await expect(page.locator('.commit-list')).toBeVisible()
    await expect(page.locator('.blame-view')).toHaveCount(0)
  })

  test('Left and Right never leave the view', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.blame-view')).toBeVisible()
    await expect(page.locator('.blame-row.cursor')).toBeVisible()
  })

  test('the same-commit tint is left off when one commit owns most of the file', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    await expect(page.locator('.blame-row.cursor')).toContainText('const value1 = 1')
    await expect(page.locator('.blame-row.same-commit')).toHaveCount(0)
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown')
    await expect(page.locator('.blame-row.cursor')).toContainText("const changed5 = 'edited'")
    await expect(page.locator('.blame-row.cursor')).toHaveClass(/same-commit/)
  })

  test('changing Ignore whitespace keeps the lines on screen while it reloads', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    // Samples every frame, so a frame with no rows (the flash) would show up as a zero.
    await page.evaluate(() => {
      const w = window as unknown as { rowCounts: number[] }
      w.rowCounts = []
      const sample = () => {
        w.rowCounts.push(document.querySelectorAll('.blame-row').length)
        requestAnimationFrame(sample)
      }
      sample()
    })
    const toggle = page.getByRole('button', { name: 'Ignore whitespace' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(500)
    const counts = await page.evaluate(() => (window as unknown as { rowCounts: number[] }).rowCounts)
    expect(counts.length).toBeGreaterThan(5)
    expect(Math.min(...counts)).toBeGreaterThan(0)
  })

  test('find jumps between matches, ":N" goes to a line, and Escape closes the bar but never leaves the view', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    const cursor = page.locator('.blame-row.cursor')
    const bar = page.locator('.find-bar')
    const field = page.getByRole('textbox', { name: 'Find in file' })

    await page.keyboard.press('/')
    await expect(field).toBeFocused()
    // The bar keeps one size whatever is typed: empty, a partial word, no match, a go-to-line, a match.
    const widths = new Set<number>()
    const measure = async () => widths.add(Math.round((await bar.boundingBox())!.width))
    await measure()
    for (const text of ['c', 'chang', 'changedzzz', ':', ':1200', 'changed']) {
      await page.keyboard.press('Control+a')
      await page.keyboard.type(text)
      await measure()
    }
    expect([...widths]).toHaveLength(1)
    await page.keyboard.press('Control+a')
    await page.keyboard.type('changed')
    await expect(bar).toContainText('1 of 3')
    await expect(cursor).toContainText('changed5')
    await expect(page.locator('.blame-row.cursor .find-hit')).toHaveText('changed')
    // Focus is in the find box, so the current match must still be marked, and marked apart from other matches.
    await expect(page.locator('.blame-view .diff')).toHaveClass(/finding/)
    expect(await cursor.evaluate((row) => getComputedStyle(row, '::after').borderTopStyle)).toBe('solid')
    expect(
      await page
        .locator('.blame-row:not(.cursor)')
        .first()
        .evaluate((row) => getComputedStyle(row, '::after').borderTopStyle)
    ).not.toBe('solid')
    await page.keyboard.press('Enter')
    await expect(bar).toContainText('2 of 3')
    await expect(cursor).toContainText('changed60')
    await page.keyboard.press('Shift+Enter')
    await expect(cursor).toContainText('changed5')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(cursor).toContainText('changed110')
    await page.keyboard.press('Enter')
    await expect(cursor).toContainText('changed5')

    // Every occurrence counts: each edited line has "ed" three times (chang-ed, 'ed'ited, edit-ed).
    await page.keyboard.press('Control+a')
    await page.keyboard.type('ed')
    await expect(bar).toContainText('1 of 9')
    await expect(page.locator('.blame-row.cursor .find-hit')).toHaveCount(3)
    await expect(page.locator('.blame-row.cursor .find-hit.current')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(bar).toContainText('2 of 9')
    await expect(cursor).toContainText('changed5')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(bar).toContainText('4 of 9')
    await expect(cursor).toContainText('changed60')
    await page.keyboard.press('Shift+Enter')
    await expect(bar).toContainText('3 of 9')
    await expect(cursor).toContainText('changed5')

    await page.keyboard.press('Control+a')
    await page.keyboard.type(':100')
    await expect(bar).toContainText('Go to line 100')
    await expect(cursor).toContainText('value100')
    await page.keyboard.press('Control+a')
    await page.keyboard.type(':7')
    await page.keyboard.press('Enter')
    await expect(bar).toHaveCount(0)
    await expect(page.locator('.blame-view .diff')).toBeFocused()
    await expect(cursor).toContainText('const value7 = 7')

    await page.keyboard.press('Control+f')
    await expect(field).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(bar).toHaveCount(0)
    await expect(page.locator('.blame-view')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.blame-view')).toBeVisible()
    await expect(page.locator('.blame-view .diff')).toBeFocused()
  })

  test('the header buttons do what N, P, / and B do, and hand focus back to the code', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    const cursor = page.locator('.blame-row.cursor')
    const tools = page.getByRole('toolbar', { name: 'Blame tools' })

    await expect(tools.getByRole('button', { name: 'Previous commit block' })).toBeDisabled()
    await tools.getByRole('button', { name: 'Next commit block' }).click()
    await expect(cursor).toContainText("const changed5 = 'edited'")
    await expect(page.locator('.blame-view .diff')).toBeFocused()
    await tools.getByRole('button', { name: 'Blame before this commit' }).click()
    await expect(page.locator('.blame-past')).toContainText('At HEAD')
    await expect(cursor).toContainText('const value5 = 5')
    await page.getByRole('button', { name: 'Back to newer' }).click()

    await tools.getByRole('button', { name: 'Find in file' }).click()
    await expect(page.getByRole('textbox', { name: 'Find in file' })).toBeFocused()
    await page.keyboard.type('changed')
    await page.getByRole('button', { name: 'Next match' }).click()
    await expect(cursor).toContainText('changed60')
    await expect(page.getByRole('textbox', { name: 'Find in file' })).toBeFocused()
    await page.getByRole('button', { name: 'Previous match' }).click()
    await expect(cursor).toContainText('changed5')

    // From the keyboard the button keeps focus, so Enter on it can be pressed again and again to search backwards.
    await page.keyboard.press('Tab')
    const previous = page.getByRole('button', { name: 'Previous match' })
    await expect(previous).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(cursor).toContainText('changed110')
    await page.keyboard.press('Enter')
    await expect(cursor).toContainText('changed60')
    await expect(previous).toBeFocused()
  })

  test('B blames the line as it was before its commit, Backspace returns, and Escape neither steps nor leaves', async ({ open, small }) => {
    git(small, 'add', '-A')
    git(small, 'commit', '-q', '-m', 'Edit lines')
    // The file needs a change of its own to be listed in Changes, where the blame is opened from.
    write(
      small,
      'src/app.ts',
      numberedLines(120, (n) => (n === 5 || n === 60 || n === 110 ? `const changed${n} = 'edited'` : n === 120 ? 'const last = 1' : null))
    )
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    const cursor = page.locator('.blame-row.cursor')

    // The first line is from the root commit, so there is nothing earlier to show.
    await page.keyboard.press('Home')
    await expect(page.locator('.blame-preview-step')).toHaveText('First version')
    await page.keyboard.press('b')
    await expect(page.locator('.blame-past')).toHaveCount(0)
    await expect(page.locator('.blame-note')).toContainText('No earlier version')

    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown')
    await expect(cursor).toContainText("const changed5 = 'edited'")
    const top = async () => (await cursor.boundingBox())!.y
    const before = await top()
    await page.keyboard.press('b')
    await expect(page.locator('.blame-past')).toContainText('Edit lines')
    await expect(cursor).toContainText('const value5 = 5')
    // The line stays where the eye left it while the numbers underneath change.
    expect(Math.abs((await top()) - before)).toBeLessThan(2)
    await expect(page.locator('.blame-view')).toHaveClass(/stepped/)

    await page.keyboard.press('Backspace')
    await expect(page.locator('.blame-past')).toHaveCount(0)
    await expect(cursor).toContainText("const changed5 = 'edited'")

    await page.keyboard.press('b')
    await expect(page.locator('.blame-past')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.blame-view')).toBeVisible()
    await expect(page.locator('.blame-past')).toBeVisible()
  })

  test('lines named by skipping an ignored commit are marked, and the list can be switched off', async ({ open, small }) => {
    write(
      small,
      'src/app.ts',
      numberedLines(120, (n) => (n === 3 ? '  const value3 = 3' : null))
    )
    git(small, 'add', '-A')
    git(small, 'commit', '-q', '-m', 'Reformat')
    write(small, '.git-blame-ignore-revs', `${git(small, 'rev-parse', 'HEAD').trim()}\n`)
    write(
      small,
      'src/app.ts',
      numberedLines(120, (n) => (n === 3 ? '  const value3 = 3' : n === 120 ? 'const last = 1' : null))
    )
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    const cursor = page.locator('.blame-row.cursor')
    await expect(cursor).toContainText('const value3 = 3')
    await expect(cursor).toHaveClass(/ignored/)
    await expect(page.locator('.blame-ignored')).toBeVisible()
    await expect(page.locator('.blame-preview')).toContainText('Initial commit')

    const toggle = page.getByRole('button', { name: 'Ignore bulk commits' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.blame-preview')).toContainText('Reformat')
    await expect(page.locator('.blame-ignored')).toHaveCount(0)
    await expect(page.locator('.blame-row.ignored')).toHaveCount(0)
  })

  test('B on a line that is not committed yet blames HEAD', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show blame' }).click()
    await expect(page.locator('.blame-row').first()).toBeVisible()
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown')
    await expect(page.locator('.blame-row.cursor')).toContainText("const changed5 = 'edited'")
    await page.keyboard.press('b')
    await expect(page.locator('.blame-past')).toContainText('At HEAD')
    await expect(page.locator('.blame-row.cursor')).toContainText('const value5 = 5')
    await page.getByRole('button', { name: 'Back to newer' }).click()
    await expect(page.locator('.blame-past')).toHaveCount(0)
  })

  test('Space shows the full commit message in a popover that Escape closes without leaving the view', async ({ open, small }) => {
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
    await expect(page.locator('.blame-view')).toBeHidden()
    await expect(page.locator('[role=grid]:focus, [role=grid] :focus').first()).toBeAttached()

    await page.keyboard.press('Control+3')
    await expect(page.locator('.blame-row.cursor')).toBeVisible()
  })
})

test.describe('layout', () => {
  test('F11 expands the code area and keeps the file list, F hides the list, and F11 restores the layout', async ({ open, small }) => {
    const page = await open(small)
    await page.getByRole('row', { name: /app\.ts/ }).click()
    const files = page.getByRole('row', { name: /notes\.txt/ })
    const layout = page.locator('[data-workspace-layout]')
    await expect(layout).toHaveAttribute('data-workspace-layout', 'standard')
    await expect(files).toBeVisible()
    await page.keyboard.press('F11')
    await expect(layout).toHaveAttribute('data-workspace-layout', 'code')
    await expect(files).toBeVisible()
    await page.keyboard.press('f')
    await expect(files).toBeHidden()
    await page.keyboard.press('F11')
    await expect(layout).toHaveAttribute('data-workspace-layout', 'standard')
    await expect(files).toBeVisible()
  })
})
