import { expect, test } from './fixtures'
import type { Locator, Page } from '@playwright/test'

/** Waits out the open animation and the height transition, so sizes are final. */
async function settle(panel: Locator) {
  await panel.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished))
  })
}

const top = async (locator: Locator) => (await locator.boundingBox())!.y
const height = async (locator: Locator) => (await locator.boundingBox())!.height

/** Results follow typing a moment later (deferred), then the height transitions; wait for the final size. */
async function settledHeight(panel: Locator, ok: (h: number) => boolean) {
  await expect.poll(async () => ok(await height(panel))).toBe(true)
  await settle(panel)
  return height(panel)
}

/** Typing narrows the results: the search box stays put, the panel shrinks from the bottom and never grows back past its start. */
async function expectShrinksInPlace(panel: Locator, input: Locator, narrow: string, none: string, empty: Locator) {
  await settle(panel)
  const inputTop = await top(input)
  const panelTop = await top(panel)
  const full = await height(panel)

  await input.fill(narrow)
  const narrowed = await settledHeight(panel, (h) => h < full)
  expect(narrowed).toBeLessThan(full)
  expect(await top(input)).toBe(inputTop)
  expect(await top(panel)).toBe(panelTop)

  await input.fill(none)
  await expect(empty).toBeVisible()
  expect(await settledHeight(panel, (h) => h <= narrowed + 1)).toBeLessThanOrEqual(narrowed + 1)
  expect(await top(input)).toBe(inputTop)
  expect(await top(panel)).toBe(panelTop)

  await input.fill('')
  expect(await settledHeight(panel, (h) => h >= full - 1)).toBe(full)
  expect(await top(input)).toBe(inputTop)
}

async function noClipping(panel: Locator) {
  const clipped = await panel.locator('.palette-row').evaluateAll((rows) => rows.some((row) => row.scrollWidth > row.clientWidth))
  expect(clipped).toBe(false)
}

async function openCommands(page: Page) {
  await page.keyboard.press('Control+Shift+P')
  const panel = page.locator('.command-palette')
  const input = panel.getByRole('textbox')
  await expect(input).toBeFocused()
  return { panel, input, empty: panel.getByText('No matches', { exact: true }) }
}

test('command palette shrinks in place', async ({ open, small }) => {
  const page = await open(small)
  const { panel, input, empty } = await openCommands(page)
  await expectShrinksInPlace(panel, input, 'Preferences', 'zzzz no matching command', empty)
  await noClipping(panel)
})

test('one match and no match are the same height', async ({ open, small }) => {
  const page = await open(small)
  const { panel, input, empty } = await openCommands(page)
  await input.fill('Preferences')
  await expect(panel.getByRole('option')).toHaveCount(1)
  const one = await settledHeight(panel, (h) => h < 200)
  await input.fill('zzzz no matching command')
  await expect(empty).toBeVisible()
  await settle(panel)
  expect(await height(panel)).toBe(one)
})

test('file find shrinks in place', async ({ open, small }) => {
  const page = await open(small)
  await page.getByRole('row', { name: /app\.ts/ }).click()
  await page.keyboard.press('/')
  const panel = page.locator('.palette')
  const input = panel.getByRole('textbox')
  await expect(input).toBeFocused()
  await expectShrinksInPlace(panel, input, 'app', 'zzzz-no-file', panel.getByText('No matches', { exact: true }))
})

test('branch and repository dropdowns shrink in place under their button', async ({ open, small }) => {
  const page = await open(small)
  for (const trigger of ['.tb-branch', '.tb-repo']) {
    await page.locator(trigger).click()
    const panel = page.locator('.palette.dropdown')
    const input = panel.getByRole('textbox')
    await expect(input).toBeFocused()
    await settle(panel)
    const button = await page.locator(trigger).boundingBox()
    const panelTop = await top(panel)
    expect(panelTop).toBeGreaterThan(button!.y)
    const full = await height(panel)
    await input.fill('zzzz-no-matching-item')
    await expect(panel.getByText('No matches', { exact: true }).or(panel.getByRole('option')).first()).toBeVisible()
    expect(await settledHeight(panel, (h) => h <= full)).toBeLessThanOrEqual(full)
    expect(await top(panel)).toBe(panelTop)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
  }
})

test('keyboard shortcuts dialog keeps its size and footer while searching', async ({ open, small }) => {
  const page = await open(small)
  await page.keyboard.press('Control+/')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  const modal = page.locator('.modal')
  const input = dialog.getByRole('textbox', { name: 'Search shortcuts' })
  const close = dialog.getByRole('button', { name: 'Close', exact: true })
  await expect(input).toBeFocused()
  await settle(modal)
  const before = { modal: await modal.boundingBox(), input: await top(input), close: await top(close) }
  await input.fill('zzzz no shortcut')
  await expect(dialog.getByText('No shortcuts match', { exact: false })).toBeVisible()
  expect(await modal.boundingBox()).toEqual(before.modal)
  expect(await top(input)).toBe(before.input)
  expect(await top(close)).toBe(before.close)
  await input.fill('')
  await expect(dialog.getByRole('region', { name: 'Keyboard shortcut results' }).locator('section').first()).toBeVisible()
  expect(await modal.boundingBox()).toEqual(before.modal)
})
