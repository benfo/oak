import { expect, test } from './fixtures'
import { commitAll, write } from './repos'

const svg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${fill}"/></svg>\n`

test('an SVG opens as a before and after preview, switches to the diff and back, and remembers the choice', async ({ open, small }) => {
  write(small, 'icons/a.svg', svg('red'))
  write(small, 'icons/b.svg', svg('green'))
  commitAll(small, 'Add icons')
  write(small, 'icons/a.svg', svg('blue'))
  write(small, 'icons/b.svg', svg('black'))
  const page = await open(small)
  const pane = page.locator('.changes-diff')
  await page.getByRole('row', { name: /a\.svg/ }).click()
  await expect(pane.locator('.preview-side')).toHaveCount(2)
  await expect(pane.locator('.preview-side[aria-label="Before"] img')).toHaveAttribute('src', /^data:image\/svg\+xml/)
  await expect(pane.locator('.preview-side[aria-label="After"] img')).toBeVisible()
  const toggle = pane.getByRole('group', { name: 'View' })
  await expect(toggle.getByRole('button', { name: 'Preview', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const titleBox = await pane.locator('.diff-title').boundingBox()

  await toggle.getByRole('button', { name: 'Diff', exact: true }).click()
  await expect(pane.locator('.dl.add')).toHaveCount(1)
  expect(await pane.locator('.diff-title').boundingBox()).toEqual(titleBox)

  // The choice is kept for the next SVG.
  await page.getByRole('row', { name: /b\.svg/ }).click()
  await expect(pane.locator('.dl.add')).toHaveCount(1)
  await toggle.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(pane.locator('.preview-side')).toHaveCount(2)
})

test('an added SVG shows one labelled side, and other files have no switch', async ({ open, small }) => {
  write(small, 'new.svg', svg('red'))
  const page = await open(small)
  const pane = page.locator('.changes-diff')
  await page.getByRole('row', { name: /new\.svg/ }).click()
  await expect(pane.locator('.preview-side')).toHaveCount(1)
  await expect(pane.locator('.preview-side[aria-label="Added"] img')).toBeVisible()
  await page.getByRole('row', { name: /\.ts/ }).first().click()
  await expect(pane.locator('.dl').first()).toBeVisible()
  await expect(pane.getByRole('group', { name: 'View' })).toHaveCount(0)
})

test('an SVG that cannot be drawn explains itself and offers the diff, and scripts in it never run', async ({ open, small }) => {
  write(small, 'bad.svg', 'this is not an svg\n')
  write(small, 'evil.svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="window.pwned=1"><script>window.pwned=1</script></svg>\n')
  const page = await open(small)
  const pane = page.locator('.changes-diff')
  await page.getByRole('row', { name: /bad\.svg/ }).click()
  await expect(pane.locator('.preview-notice')).toContainText("Can't draw this file")
  await pane.getByRole('button', { name: 'Show diff' }).click()
  await expect(pane.locator('.dl.add')).toHaveCount(1)
  await pane.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('row', { name: /evil\.svg/ }).click()
  await expect(pane.locator('.preview-side img')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined()
})

test('a very large SVG is scaled to fit inside its side of the pane', async ({ open, small }) => {
  write(
    small,
    'big.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="6000" height="4000"><rect width="6000" height="4000" fill="red"/></svg>\n'
  )
  write(
    small,
    'tall.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="9000"><rect width="300" height="9000" fill="red"/></svg>\n'
  )
  const page = await open(small)
  const pane = page.locator('.changes-diff .preview-pane')
  for (const name of [/big\.svg/, /tall\.svg/]) {
    await page.getByRole('row', { name }).click()
    const img = pane.locator('.preview-image')
    await expect(img).toBeVisible()
    const [outer, inner] = [await pane.boundingBox(), await img.boundingBox()]
    expect(inner!.x).toBeGreaterThanOrEqual(outer!.x)
    expect(inner!.y).toBeGreaterThanOrEqual(outer!.y)
    expect(inner!.x + inner!.width).toBeLessThanOrEqual(outer!.x + outer!.width)
    expect(inner!.y + inner!.height).toBeLessThanOrEqual(outer!.y + outer!.height)
    expect(await pane.evaluate((el) => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true)
  }
})

// A path long enough to be truncated, so the room the tools leave it can't matter.
const LONG = 'assets/design-system/components/navigation/icons/a-really-quite-long-icon-name.svg'

test('switching between Diff and Preview moves nothing, so the same spot can be clicked again, at any pane width', async ({
  open,
  small
}) => {
  write(small, LONG, svg('red'))
  commitAll(small, 'Add icon')
  write(small, LONG, svg('blue'))
  const page = await open(small)
  const pane = page.locator('.changes-diff')
  await page.getByRole('row', { name: /really-quite-long-icon-name/ }).click()
  const toggle = pane.getByRole('group', { name: 'View' })
  const layout = async () => ({
    toggle: await toggle.boundingBox(),
    filenameX: (await pane.locator('.diff-filename').boundingBox())?.x
  })
  for (const width of [null, 480, 160]) {
    if (width) await pane.evaluate((el, w) => Object.assign(el.style, { flex: 'none', width: `${w}px` }), width)
    await expect(pane.locator('.preview-side')).toHaveCount(2)
    const preview = await layout()
    // The filename gives way before the switch does, however small the pane.
    const group = preview.toggle!
    expect(group.x + group.width).toBeLessThanOrEqual(preview.filenameX!)
    await toggle.getByRole('button', { name: 'Diff', exact: true }).click()
    await expect(pane.locator('.dl.add')).toHaveCount(1)
    // Narrow panes may wrap the tools onto a second row in Diff, so only the switch and filename are held still.
    expect(await layout()).toEqual(preview)
    // The same spot works again without moving the pointer.
    const spot = preview.toggle!
    await page.mouse.click(spot.x + spot.width - 10, spot.y + spot.height / 2)
    await expect(pane.locator('.preview-side')).toHaveCount(2)
    expect(await layout()).toEqual(preview)
  }
})
