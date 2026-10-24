import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

/*
 * Automatic updates (electron-updater). Releases are published to GitHub (`publish` in
 * package.json, `npm run release`); the installed app checks there, downloads a newer version in
 * the background and installs it on restart. The renderer decides when to check (its "check
 * automatically" preference) and offers the restart. Only the installed app can update itself.
 */

const { autoUpdater } = electronUpdater
let status: UpdateStatus = app.isPackaged ? { state: 'idle' } : { state: 'unsupported' }

function set(next: UpdateStatus) {
  status = next
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('update-status', status)
}

if (app.isPackaged) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => status.state !== 'ready' && set({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ state: 'latest' }))
  autoUpdater.on('update-available', (i) => set({ state: 'downloading', version: i.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => status.state === 'downloading' && set({ ...status, percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (i) => set({ state: 'ready', version: i.version }))
  autoUpdater.on('error', (e) => {
    if (status.state === 'ready') return
    const first = e.message.split('\n')[0]
    set({ state: 'error', message: /^404\b/.test(first) ? 'no releases found' : first })
  })
}

export const updateStatus = () => status

export async function checkForUpdates() {
  // Once an update is downloaded there's nothing more to do until the restart.
  if (!app.isPackaged || status.state === 'ready' || status.state === 'checking' || status.state === 'downloading') return status
  await autoUpdater.checkForUpdates().catch(() => {}) // reported through the 'error' event
  return status
}

/** Quits, installs the downloaded update and starts the new version. The one-click installer shows its progress window so the gap between quitting and relaunching doesn't look like a crash. */
export function installUpdate() {
  if (status.state === 'ready') autoUpdater.quitAndInstall(false, true)
}
