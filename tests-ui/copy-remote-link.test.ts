import { expect, test } from './fixtures'
import { git } from './repos'

test('Copy > Commit link is unavailable while the commit is unpushed, then copies the permalink', async ({ open, small }) => {
  git(small, 'remote', 'add', 'origin', 'git@github.com:acme/app.git')
  const hash = git(small, 'rev-parse', 'HEAD').trim()
  const page = await open(small, 'history')
  const row = page.locator('.commit-list').getByRole('option', { name: /Initial commit/ })
  const closeMenu = async () => {
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.menu-popover')).toHaveCount(0)
  }
  /** Opens the commit's Copy submenu and looks for the link item by name; the lookup of unpushed commits runs in the background. */
  const linkItem = (name: string, exact = false) => page.getByRole('menuitem', { name, exact })
  const expectLink = async (name: string, exact = false) =>
    expect(async () => {
      await row.click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Copy' }).click()
      try {
        await expect(linkItem(name, exact)).toBeVisible({ timeout: 500 })
      } catch (e) {
        await closeMenu()
        throw e
      }
    }).toPass({ timeout: 10_000 })

  await expectLink('Commit link (not pushed)')
  await expect(linkItem('Commit link (not pushed)')).toHaveAttribute('aria-disabled', 'true')
  // Opening the page is held to the same rule as copying its link.
  await expect(linkItem('Open in browser (not pushed)')).toHaveAttribute('aria-disabled', 'true')
  await closeMenu()

  // Once a remote branch contains the commit, Oak notices (the watcher refreshes refs) and the item works.
  git(small, 'update-ref', 'refs/remotes/origin/main', hash)
  await expectLink('Commit link', true)
  await expect(linkItem('Open in browser', true)).toBeEnabled()
  await linkItem('Commit link', true).click()
  await expect(page.locator('.toast').last()).toContainText('Copied commit link')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://github.com/acme/app/commit/${hash}`)
})

test('file links fall back to the newest pushed commit, and only when that link would open', async ({ open, small }) => {
  git(small, 'remote', 'add', 'origin', 'git@github.com:acme/app.git')
  const pushed = git(small, 'rev-parse', 'HEAD').trim()
  git(small, 'update-ref', 'refs/remotes/origin/main', pushed)
  // An unpushed commit that edits one file, leaves README.md alone and adds a new file.
  git(small, 'add', 'src/app.ts')
  git(small, 'commit', '-m', 'Edit app')
  git(small, 'add', '-A')
  git(small, 'commit', '-m', 'Add notes')
  const page = await open(small, 'history')
  const link = (target: object) =>
    page.evaluate(
      ([repo, t]) =>
        (window as unknown as { bridge: { invoke: (...a: unknown[]) => Promise<string> } }).bridge.invoke('remotePage', repo, t),
      [small, target] as const
    )
  const blob = (path: string, line = '') => `https://github.com/acme/app/blob/${pushed}/${path}${line}`

  // Edited since the pushed commit: the file link works (at the pushed commit), a line link could point at different code.
  expect(await link({ kind: 'file', hash: 'HEAD', path: 'src/app.ts' })).toBe(blob('src/app.ts'))
  await expect(link({ kind: 'file', hash: 'HEAD', path: 'src/app.ts', line: 5 })).rejects.toThrow('could point at different code')
  // Unchanged since the pushed commit: even a line link is safe.
  expect(await link({ kind: 'file', hash: 'HEAD', path: 'README.md', line: 1 })).toBe(blob('README.md', '#L1'))
  // New in an unpushed commit: nothing on the remote to link to.
  await expect(link({ kind: 'file', hash: 'HEAD', path: 'notes.txt' })).rejects.toThrow("isn't on origin yet")
  // A commit link has no fallback.
  await expect(link({ kind: 'commit', hash: 'HEAD' })).rejects.toThrow("This commit isn't on origin yet")
})
