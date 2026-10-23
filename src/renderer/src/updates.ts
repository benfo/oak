import { useSyncExternalStore } from 'react'
import { api } from './api'
import { createStore } from './ui'
import { getSettings } from './settings'
import type { UpdateStatus } from '../../shared/types'

/*
 * Self-update state, mirrored from the main process (src/main/updater.ts). With "check
 * automatically" on, Oak checks shortly after launch and then every few hours; a newer version
 * downloads in the background and UpdateNotice offers the restart (it also installs on quit).
 */

const store = createStore<UpdateStatus>({ state: 'idle' })
export const useUpdateStatus = () => useSyncExternalStore(store.subscribe, store.get)
export const checkForUpdates = () => api.checkForUpdates()
export const installUpdate = () => api.installUpdate()

const FIRST_CHECK_MS = 10_000
const EVERY_MS = 4 * 60 * 60 * 1000

export function initUpdates() {
  window.bridge.onUpdateStatus((s) => store.set(s as UpdateStatus))
  api.updateStatus().then((s) => {
    store.set(s)
    if (s.state === 'unsupported') return
    const auto = () => getSettings().autoUpdate && checkForUpdates()
    setTimeout(auto, FIRST_CHECK_MS)
    setInterval(auto, EVERY_MS)
  })
}

/** One line for Preferences. */
export function describeUpdate(s: UpdateStatus): string {
  switch (s.state) {
    case 'unsupported':
      return 'Updates work in the installed app (not in dev builds).'
    case 'idle':
      return ''
    case 'checking':
      return 'Checking for updates…'
    case 'latest':
      return 'Oak is up to date.'
    case 'downloading':
      return `Downloading Oak ${s.version}… ${s.percent}%`
    case 'ready':
      return `Oak ${s.version} is ready. It installs when you restart or close Oak.`
    case 'error':
      return `Couldn't check for updates: ${s.message}`
  }
}
