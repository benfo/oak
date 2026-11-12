import { expect, test } from './fixtures'
import { git } from './repos'

test('hidden lines between and around hunks can be revealed, by button and by key, and still stage correctly', async ({ open, small }) => {
  const page = await open(small)
  await page.getByRole('row', { name: /app\.ts/ }).click()
  const diff = page.locator('.changes-diff .diff')
  await expect(diff.locator('.hunk-header:not(.hunk-footer)')).toHaveCount(3)
  const line = (n: number) => diff.locator(`.dl[data-new-line="${n}"]`)
  await expect(line(28)).toHaveCount(0)

  const between = diff.locator('.hunk-header:not(.hunk-footer)').nth(1)
  await between.getByRole('button', { name: 'Show 20 more lines below' }).click()
  await expect(line(28)).toHaveCount(1)
  await expect(line(29)).toHaveCount(0)
  await expect(diff.locator('.hunk-header:not(.hunk-footer)')).toHaveCount(3)

  await diff.locator('.hunk-header:not(.hunk-footer)').first().getByRole('button', { name: 'Show the 1 hidden line' }).click()
  await expect(line(1)).toHaveCount(1)

  await line(110).locator('.gutter').click()
  await page.keyboard.press('e')
  await expect(line(87)).toHaveCount(1)
  await expect(line(120)).toHaveCount(1)
  await expect(diff.locator('.dl.cursor')).toHaveAttribute('data-new-line', '110')

  await diff.locator('.hunk-header:not(.hunk-footer)').first().getByRole('button', { name: 'Stage hunk' }).click()
  await expect.poll(() => git(small, 'diff', '--cached', '-U0')).toContain("+const changed5 = 'edited'")
  expect(git(small, 'diff', '--cached', '-U0')).not.toContain('changed60')
})
