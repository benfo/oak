import type { BrowserWindow } from 'electron'

/** Windows (by id) currently simulating high contrast. */
const simulated = new Set<number>()

/**
 * Dev builds only: Shift+F12 simulates Windows high contrast (forced colours) in this window, and again turns it off,
 * so high-contrast styles can be checked without changing Windows settings. Uses the same emulation as the UI tests.
 */
export async function toggleForcedColours(win: BrowserWindow): Promise<void> {
  const cdp = win.webContents.debugger
  if (!cdp.isAttached()) cdp.attach()
  const on = !simulated.has(win.id)
  await cdp.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: on ? 'active' : 'none' }] })
  if (on) simulated.add(win.id)
  else simulated.delete(win.id)
}
