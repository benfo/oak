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

  test('scrolls a 5,000 commit history to the end with only a window rendered', async ({ open, commits5k }) => {
    const page = await open(commits5k, 'history')
    const list = page.locator('.commit-list')
    await expect(list).toContainText('Commit number 5000')
    await list.focus()
    // Each End at the end of the loaded commits pulls in the next page, so keep pressing it until the oldest commit shows.
    const last = list.getByText('Commit number 1', { exact: true })
    await expect(async () => {
      await page.keyboard.press('End')
      await expect(last).toBeVisible({ timeout: 2000 })
    }).toPass({ timeout: 30_000 })
    expect(await list.locator('[data-index], [role=row]').count()).toBeLessThan(300)
  })
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
