import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type WindowState = { bounds: Rectangle; maximized: boolean }

const file = () => path.join(app.getPath('userData'), 'window-state.json')
const MIN_VISIBLE = 100

const isRect = (b: unknown): b is Rectangle => {
  const r = b as Rectangle
  return !!r && [r.x, r.y, r.width, r.height].every((n) => Number.isFinite(n)) && r.width > 0 && r.height > 0
}

export function loadWindowState(): WindowState | null {
  try {
    const s = JSON.parse(readFileSync(file(), 'utf8'))
    if (!isRect(s?.bounds)) return null
    return { bounds: s.bounds, maximized: s.maximized === true }
  } catch {
    return null
  }
}

const overlap = (a: Rectangle, b: Rectangle) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return Math.max(0, w) * Math.max(0, h) > 0 ? { w, h } : null
}

/** Fits saved bounds to the connected displays: never hidden, never larger than the work area. */
export function fitToDisplays(saved: Rectangle, min: { width: number; height: number }): Rectangle {
  const displays = screen.getAllDisplays()
  const visible = displays.find((d) => {
    const o = overlap(saved, d.workArea)
    return o && o.w >= Math.min(MIN_VISIBLE, saved.width) && o.h >= Math.min(MIN_VISIBLE, saved.height)
  })
  const target = visible ?? screen.getPrimaryDisplay()
  const area = target.workArea
  const width = Math.min(saved.width, area.width)
  const height = Math.min(saved.height, area.height)
  if (!visible) {
    return { width, height, x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2) }
  }
  const x = Math.min(Math.max(saved.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(saved.y, area.y), area.y + area.height - height)
  return { x, y, width: Math.max(width, Math.min(min.width, area.width)), height: Math.max(height, Math.min(min.height, area.height)) }
}

/** Persists the window's normal bounds and maximized flag (debounced while moving/resizing, immediately on close). */
export function trackWindowState(win: BrowserWindow) {
  let timer: NodeJS.Timeout | undefined
  const save = () => {
    clearTimeout(timer)
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
    const state: WindowState = { bounds: win.getNormalBounds(), maximized: win.isMaximized() }
    try {
      writeFileSync(file(), JSON.stringify(state))
    } catch {
      // best-effort
    }
  }
  const later = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  win.on('resize', later)
  win.on('move', later)
  win.on('maximize', later)
  win.on('unmaximize', later)
  win.on('close', save)
}
