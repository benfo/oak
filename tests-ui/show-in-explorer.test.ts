import { expect, test } from './fixtures'
import type { ElectronApplication, Page } from '@playwright/test'

/** Records the repo-relative paths Show in Explorer asks for instead of opening Explorer. */
async function stubExplorer(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }) => {
    const revealed: string[] = []
    ;(globalThis as { revealed?: string[] }).revealed = revealed
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (...a: unknown[]) => unknown> })._invokeHandlers
    // The last argument is the path (after the IPC event and the repo).
    handlers.set('git:revealFile', (...a) => void revealed.push(String(a.flat().at(-1))))
  })
  return () => app.evaluate(() => (globalThis as { revealed?: string[] }).revealed!.splice(0))
}

async function showInExplorer(page: Page) {
  await page.locator('.menu-popover').getByRole('menuitem', { name: 'Show in Explorer' }).click()
}

test('Show in Explorer opens folder rows in Changes, a commit tree and All files', async ({ openApp, small }) => {
  const { app, page } = await openApp(small)
  const revealed = await stubExplorer(app)
  const folder = 'src'

  await page.getByRole('button', { name: 'Show files as a tree' }).click()
  await page.locator('.folder-row').filter({ hasText: 'src' }).first().click({ button: 'right' })
  await showInExplorer(page)
  await expect.poll(revealed).toEqual([folder])

  await page.keyboard.press('Control+2')
  await page
    .locator('.commit-list')
    .getByRole('option', { name: /Initial commit/ })
    .click()
  await page.locator('.details-files .folder-row').filter({ hasText: 'src' }).click({ button: 'right' })
  await showInExplorer(page)
  await expect.poll(revealed).toEqual([folder])

  await page.getByRole('button', { name: 'All files' }).click()
  const tree = page.getByRole('treegrid', { name: 'Files in this commit' })
  await tree.getByRole('row', { name: /^src/ }).focus()
  await page.keyboard.press('Shift+F10')
  await expect(page.locator('.menu-popover').getByRole('menuitem', { name: 'Show in Explorer' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(revealed).toEqual([folder])
})
