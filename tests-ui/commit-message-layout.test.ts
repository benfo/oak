import { expect, test } from './fixtures'
import { git } from './repos'

test('a very long commit message scrolls as one area; the author rows stay pinned unless the pane is short', async ({ open, small }) => {
  git(small, 'add', '-A')
  const body = Array.from({ length: 80 }, (_, i) => `Line ${i + 1} of a very long commit message`).join('\n\n')
  git(small, 'commit', '-m', 'Subject of the long commit', '-m', body)
  const page = await open(small, 'history')
  await page.locator('.commit-row').filter({ hasText: 'Subject of the long commit' }).first().click()
  const meta = page.locator('.commit-meta')
  await expect(meta.locator('.commit-subject')).toBeVisible()
  const inView = async (selector: string) => {
    const outer = (await meta.boundingBox())!
    const box = (await meta.locator(selector).boundingBox())!
    return box.y >= outer.y - 1 && box.y + box.height <= outer.y + outer.height + 1
  }
  const scrollTo = (position: 'top' | 'bottom') => meta.evaluate((el, p) => (el.scrollTop = p === 'top' ? 0 : el.scrollHeight), position)
  const paneHeight = () => page.locator('.commit-info').evaluate((el) => el.clientHeight)

  // Tall pane: the subject and the author rows are pinned at both ends of the scroll.
  await page.setViewportSize({ width: 1280, height: 1100 })
  expect(await paneHeight()).toBeGreaterThanOrEqual(440)
  for (const position of ['top', 'bottom'] as const) {
    await scrollTo(position)
    expect(await inView('.commit-subject')).toBe(true)
    expect(await inView('.commit-identity')).toBe(true)
  }

  // Short pane: only the subject is pinned, the author rows scroll with the message, and a few lines of it show.
  await page.setViewportSize({ width: 1280, height: 640 })
  expect(await paneHeight()).toBeLessThan(440)
  await scrollTo('top')
  expect(await meta.locator('.commit-identity').evaluate((el) => getComputedStyle(el).position)).toBe('static')
  expect(await inView('.commit-subject')).toBe(true)
  const subjectHeight = (await meta.locator('.commit-subject').boundingBox())!.height
  expect(await meta.evaluate((el) => el.clientHeight)).toBeGreaterThanOrEqual(subjectHeight + 40)
  await scrollTo('bottom')
  expect(await inView('.commit-subject')).toBe(true)
  expect(await inView('.commit-identity')).toBe(true)

  // One scrollbar: the metadata box scrolls, the message body does not.
  expect(await meta.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  expect(await meta.locator('.commit-body').evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true)
})
