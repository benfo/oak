import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from './fixtures'
import { commitAll, git, initRepo, removeDir, tempDir } from './repos'

const changed = (repo: string, code: string) =>
  git(repo, 'status', '--porcelain')
    .split('\n')
    .filter((line) => line.startsWith(code)).length

test('more selected files than fit on a command line are staged, unstaged and discarded', async ({ open }) => {
  const dir = tempDir('many-changes')
  initRepo(dir)
  // Windows allows about 32,000 characters of arguments: 900 paths of 90 characters are well past that.
  const count = 900
  const folder = join(dir, 'backend', 'Service.Data.Fetch', 'Service.Data.Fetch.Worker', 'Common')
  const file = (i: number) => join(folder, `ImportSettingsConfiguration-${i}.cs`)
  mkdirSync(folder, { recursive: true })
  for (let i = 0; i < count; i++) writeFileSync(file(i), `${i}\n`)
  commitAll(dir, 'Base')
  for (let i = 0; i < count; i++) rmSync(file(i))

  const page = await open(dir)
  // The list follows git a moment later; acting before it has caught up would act on the old rows.
  const shown = (section: string) => page.locator(`.file-section:has(#files-${section}-label) .section-count`)
  const unstaged = page.locator('.file-section:has(#files-unstaged-label) [role=row]')
  const staged = page.locator('.file-section:has(#files-staged-label) [role=row]')
  await expect(shown('unstaged')).toHaveText(String(count))
  await unstaged.first().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Enter')
  await expect.poll(() => changed(dir, 'D ')).toBe(count)

  await expect(shown('staged')).toHaveText(String(count))
  await staged.first().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Enter')
  await expect.poll(() => changed(dir, ' D')).toBe(count)

  await expect(shown('unstaged')).toHaveText(String(count))
  await unstaged.first().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  const dialog = page.getByRole('dialog', { name: 'Discard changes' })
  await expect(dialog).toContainText(`Discard changes to ${count} files?`)
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => git(dir, 'status', '--porcelain')).toBe('')
  await expect(page.locator('.toast')).toHaveCount(0)
  removeDir(dir)
})
