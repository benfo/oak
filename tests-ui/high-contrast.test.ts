import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { commitAll, write } from './repos'

// Windows high contrast (forced colours) drops tints, shadows and accent bars, so anything shown that way needs a ring.

const outlineOf = (locator: Locator) => locator.first().evaluate((el) => getComputedStyle(el).outlineStyle)

async function highContrast(page: Page) {
  await page.emulateMedia({ forcedColors: 'active' })
  // Emulated forced colours can land a frame after the call returns.
  await expect.poll(() => page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
}

test('Windows high contrast rings the palette row, the active sidebar view and the Preferences page', async ({ open, small }) => {
  const page = await open(small)
  await highContrast(page)
  await expect.poll(() => outlineOf(page.locator('.tree-row.nav.nav-active .tree-row-content'))).toBe('solid')

  await page.keyboard.press('Control+Shift+P')
  await page.locator('.palette-input').fill('Preferences')
  await expect.poll(() => outlineOf(page.locator('.palette-item[data-focused] .palette-row'))).toBe('solid')
  await page.keyboard.press('Enter')
  await expect.poll(() => outlineOf(page.locator('.prefs-tab[data-selected]'))).toBe('solid')
})

test('Windows high contrast rings changed words, find matches and picked lines, which lose their tints there', async ({ open, small }) => {
  write(small, 'src/value.ts', "const value = 'old'\n")
  commitAll(small, 'Add value.ts')
  write(small, 'src/value.ts', "const value = 'new'\n")
  const page = await open(small)
  await highContrast(page)
  await page.getByRole('row', { name: /value\.ts/ }).click()
  const diff = page.locator('.changes-diff .diff')
  const style = (selector: string) =>
    diff
      .locator(selector)
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { outline: s.outlineStyle, background: s.backgroundColor }
      })
  await expect.poll(async () => (await style('.dl.add .word-change:not(.blank)')).outline).toBe('solid')
  expect((await style('.dl.del .word-change:not(.blank)')).outline).toBe('dashed')

  await diff.locator('.dl.add .gutter').first().click()
  const canvas = await diff.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect((await style('.dl.picked .ln')).background).not.toBe(canvas)

  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'Find in file' }).fill('const')
  expect((await style('.find-hit.current')).outline).toBe('solid')
})

test('Shift+F12 in dev builds simulates high contrast, where split lines stay drawn, and turns it off again', async ({
  openApp,
  small
}) => {
  const { app, page } = await openApp(small, 'history')
  // A real keystroke: Playwright's own key presses never reach the main process, which owns this key.
  const shiftF12 = () =>
    app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F12', modifiers: ['shift'] })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F12', modifiers: ['shift'] })
    })
  const forced = () => page.evaluate(() => matchMedia('(forced-colors: active)').matches)
  // Every drawn divider inside the views (the sidebar's own is transparent on purpose) is in the text colour.
  const visible = () =>
    page.evaluate(() => {
      const text = getComputedStyle(document.body).color
      const lines = [...document.querySelectorAll('.split .split .split-handle')].filter((el) => el.getBoundingClientRect().width > 0)
      return lines.length > 0 && lines.every((el) => getComputedStyle(el).backgroundColor === text)
    })
  await shiftF12()
  await expect.poll(forced).toBe(true)
  expect(await visible()).toBe(true)
  await shiftF12()
  await expect.poll(forced).toBe(false)
})

test('Windows high contrast marks the current hunk, keeps hunk header borders and hatches side by side filler', async ({ open, small }) => {
  write(small, 'src/added.ts', 'first\nlast\n')
  commitAll(small, 'Add added.ts')
  write(small, 'src/added.ts', 'first\nnew\nlast\n')
  const page = await open(small)
  await highContrast(page)
  await page.getByRole('row', { name: /added\.ts/ }).click()
  const diff = page.locator('.changes-diff .diff')
  await diff.locator('.dl.add .gutter').first().click()

  const header = diff.locator('.hunk-header.active-hunk')
  await expect.poll(() => outlineOf(header)).toBe('solid')
  const [border, text] = await header.evaluate((el) => [getComputedStyle(el).borderTopColor, getComputedStyle(document.body).color])
  expect(border).toBe(text)
  const bar = await diff
    .locator('.dl.active-hunk.add .gutter')
    .first()
    .evaluate((el) => getComputedStyle(el, '::before').width)
  expect(bar).toBe('2px')

  await page.keyboard.press('Control+Shift+D')
  await expect(diff).toHaveClass(/side-mode/)
  const filler = await diff
    .locator('.side-blank')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundImage)
  expect(filler).toContain('repeating-linear-gradient')
})
