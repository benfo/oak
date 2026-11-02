import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'
import { git } from './repos'

test('the status bar keeps its height, shows slow progress, then the result, then clears', async ({ open, small }) => {
  const hook = join(small, '.git', 'hooks', 'pre-commit')
  writeFileSync(hook, '#!/bin/sh\nsleep 1.5\n')
  chmodSync(hook, 0o755)
  git(small, 'add', '-A')
  const page = await open(small)

  const bar = page.locator('.status-bar')
  await expect(bar).toBeVisible()
  await expect(bar).toContainText('Not fetched yet')
  const height = async () => (await bar.boundingBox())!.height
  const idle = await height()

  const message = page.getByPlaceholder('Commit message (Ctrl+Enter to commit)')
  await message.fill('Add notes')
  await message.press('Control+Enter')

  // Progress waits for the operation to prove slow, then shows in the bar rather than the toolbar or commit box.
  await expect(bar.locator('.status-message')).toContainText('Committing…')
  expect(await height()).toBe(idle)
  await expect(page.locator('.commit-status .spinner')).toHaveCount(0)

  // The result replaces it, and the pointer is parked elsewhere so nothing holds it open.
  await page.mouse.move(5, 400)
  await expect(bar.locator('.status-message')).toContainText('Committed “Add notes”')
  expect(await height()).toBe(idle)
  await expect(bar.locator('.status-message .status-text')).toHaveCount(0, { timeout: 8000 })
  expect(await height()).toBe(idle)
})

test('progress never shows before its delay, however fast git is', async ({ open, small }) => {
  git(small, 'add', '-A')
  const page = await open(small)
  // Stamp every change of the bar's message, so the test checks when progress appears, not how long git took.
  await page.evaluate(() => {
    const w = window as unknown as { seen: { text: string; at: number }[] }
    w.seen = []
    new MutationObserver(() => {
      const text = document.querySelector('.status-message')?.textContent ?? ''
      if (text && w.seen[w.seen.length - 1]?.text !== text) w.seen.push({ text, at: performance.now() })
    }).observe(document.querySelector('.status-bar')!, { subtree: true, childList: true, characterData: true })
  })
  const message = page.getByPlaceholder('Commit message (Ctrl+Enter to commit)')
  await message.fill('Quick one')
  const pressedAt = await page.evaluate(() => performance.now())
  await message.press('Control+Enter')
  await expect(page.locator('.status-message')).toContainText('Committed “Quick one”')
  const seen = await page.evaluate(() => (window as unknown as { seen: { text: string; at: number }[] }).seen)
  // A quick commit shows no progress at all; a slower one shows it only after the 300 ms delay (allowing for the key press itself).
  for (const entry of seen.filter((e) => e.text.includes('Committing'))) expect(entry.at - pressedAt).toBeGreaterThan(250)
})

test('the status bar stays visible when the code area is expanded', async ({ open, small }) => {
  const page = await open(small)
  await page.keyboard.press('F11')
  await expect(page.locator('.app')).toHaveAttribute('data-workspace-layout', 'code')
  await expect(page.locator('.status-bar')).toBeVisible()
})
