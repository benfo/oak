import { expect, test } from './fixtures'
import { commitAll, git, initRepo, removeDir, tempDir, write } from './repos'

test('"Fetched" is an action: it explains itself on hover and fetches on click', async ({ open, small }) => {
  const remote = tempDir('remote')
  try {
    git(remote, 'init', '-q', '--bare')
    git(small, 'remote', 'add', 'origin', remote)
    git(small, 'push', '-q', 'origin', 'main')
    const page = await open(small)
    const item = page.locator('.status-bar').getByRole('button', { name: /Not fetched yet/ })
    await expect(item).toBeVisible()
    // The bar fills in as facts arrive and shifts the items beside them; wait for it to settle before pointing.
    await expect(page.locator('.status-bar').getByRole('button', { name: /just now$/ })).toBeVisible()
    // Status items are never Tab stops; Fetch has its own key.
    await expect(item).toHaveAttribute('tabindex', '-1')

    // The first pointer move after launch only wakes hover up; a second one opens the card.
    await page.mouse.move(600, 300)
    await item.hover()
    const card = page.locator('.tooltip')
    await expect(card).toContainText('Fetch all remotes')
    await expect(card).toContainText('Remotes: origin')
    await expect(card).toContainText('Automatic fetch is off')

    await item.click()
    await expect(page.locator('.status-bar').getByRole('button', { name: /Fetched just now/ })).toBeVisible()
  } finally {
    removeDir(remote)
  }
})

test('without remotes the item is a plain fact, not an action', async ({ open, small }) => {
  const page = await open(small)
  const bar = page.locator('.status-bar')
  await expect(bar).toContainText('No remotes')
  await expect(bar.getByRole('button', { name: /No remotes/ })).toHaveCount(0)
})

test('an unfinished merge shows in the bar, and a click goes to Changes', async ({ open }) => {
  const repo = tempDir('merge')
  try {
    initRepo(repo)
    write(repo, 'a.txt', 'base\n')
    commitAll(repo, 'Base')
    git(repo, 'checkout', '-q', '-b', 'other')
    write(repo, 'a.txt', 'other\n')
    commitAll(repo, 'Other')
    git(repo, 'checkout', '-q', 'main')
    write(repo, 'a.txt', 'main\n')
    commitAll(repo, 'Main')
    try {
      git(repo, 'merge', 'other')
    } catch {
      // The conflict is the point.
    }
    const page = await open(repo, 'history')
    const item = page.locator('.status-bar').getByRole('button', { name: 'Merging: 1 conflict' })
    await expect(item).toBeVisible()
    await item.click()
    await expect(page.locator('.app')).toHaveAttribute('data-workspace-view', 'changes')
  } finally {
    removeDir(repo)
  }
})

test('a rebase shows which step it is on', async ({ open }) => {
  const repo = tempDir('rebase')
  try {
    initRepo(repo)
    write(repo, 'a.txt', 'base\n')
    commitAll(repo, 'Base')
    git(repo, 'checkout', '-q', '-b', 'topic')
    write(repo, 'a.txt', 'topic\n')
    commitAll(repo, 'Topic one')
    write(repo, 'b.txt', 'second\n')
    commitAll(repo, 'Topic two')
    git(repo, 'checkout', '-q', 'main')
    write(repo, 'a.txt', 'main\n')
    commitAll(repo, 'Main')
    git(repo, 'checkout', '-q', 'topic')
    try {
      git(repo, 'rebase', 'main')
    } catch {
      // Stopping on the conflict is the point.
    }
    const page = await open(repo, 'history')
    await expect(page.locator('.status-bar').getByRole('button', { name: 'Rebasing 1/2: 1 conflict' })).toBeVisible()
  } finally {
    removeDir(repo)
  }
})

test('after "Later" on the update card, the bar brings it back', async ({ openApp, small }) => {
  const { app, page } = await openApp(small)
  const send = (status: object) =>
    app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].webContents.send('update-status', s), status)
  const card = page.locator('.update-notice')
  const item = page.locator('.status-bar').getByRole('button', { name: 'Update ready' })

  await send({ state: 'ready', version: '9.9.9' })
  await expect(card).toBeVisible()
  await expect(item).toHaveCount(0)

  await card.getByRole('button', { name: 'Later' }).click()
  await expect(card).toHaveCount(0)
  await expect(item).toBeVisible()

  await item.click()
  await expect(card).toBeVisible()
  await expect(item).toHaveCount(0)
})

test('a repository with its own identity says who commits, and a click opens Git settings', async ({ open, small }) => {
  git(small, 'config', 'user.name', 'Work Person')
  git(small, 'config', 'user.email', 'work@example.com')
  const page = await open(small)
  const item = page.locator('.status-bar').getByRole('button', { name: 'Committing as Work Person' })
  await expect(item).toBeVisible()
  await expect(item).toHaveAttribute('tabindex', '-1')

  await item.click()
  await expect(page.getByRole('dialog', { name: 'Preferences' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Git', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('the latest commit shows who made it and when, and a click shows it in History', async ({ open, small }) => {
  const page = await open(small, 'changes')
  const item = page.locator('.status-bar').getByRole('button', { name: /^Oak Test, just now$/ })
  await expect(item).toBeVisible()
  await expect(item).toHaveAttribute('tabindex', '-1')

  await page.mouse.move(600, 300)
  await item.hover()
  const card = page.locator('.tooltip')
  await expect(card).toContainText('Latest commit on main')
  await expect(card).toContainText('Oak Test <test@example.com>')

  await item.click()
  await expect(page.locator('.app')).toHaveAttribute('data-workspace-view', 'history')
})

test('the latest commit reads "You" when it is by the configured identity', async ({ open, small }) => {
  git(small, 'config', 'user.name', 'Oak Test')
  git(small, 'config', 'user.email', 'test@example.com')
  const page = await open(small, 'changes')
  await expect(page.locator('.status-bar').getByRole('button', { name: /^You, just now$/ })).toBeVisible()
})

test('a fetch run in a terminal shows up when the window regains focus', async ({ open, small }) => {
  const remote = tempDir('remote')
  try {
    git(remote, 'init', '-q', '--bare')
    git(small, 'remote', 'add', 'origin', remote)
    git(small, 'push', '-q', 'origin', 'main')
    const page = await open(small)
    const bar = page.locator('.status-bar')
    await expect(bar).toContainText('Not fetched yet')

    git(small, 'fetch', '-q', 'origin')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(bar).toContainText('Fetched just now')
  } finally {
    removeDir(remote)
  }
})
