import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { loadWindowTheme, titleBarOverlay } from './windowTheme'
import { fitToDisplays, loadWindowState, trackWindowState } from './windowState'
import { watch, writeFileSync, type FSWatcher } from 'fs'
import { join } from 'path'
import { folderArg, handlers } from './handlers'
import { outputSink } from './git'

const STREAMING = new Set([
  'commit',
  'push',
  'pull',
  'fetch',
  'cloneRepo',
  'merge',
  'rebase',
  'cherryPick',
  'revert',
  'stashPop',
  'stashApply',
  'continueOperation',
  'checkout'
])

function createWindow() {
  const theme = loadWindowTheme()
  const saved = process.env.OAK_SCREENSHOT ? null : loadWindowState()
  const bounds = saved ? fitToDisplays(saved.bounds, { width: 960, height: 600 }) : { width: 1440, height: 920 }
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Oak',
    // Dev runs the stock electron.exe; packaged builds take the icon from Oak.exe
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    backgroundColor: theme.color,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : titleBarOverlay(theme),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  if (saved?.maximized) win.maximize()
  if (!process.env.OAK_SCREENSHOT) trackWindowState(win)
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.on('before-input-event', (_e, input) => {
    // Developer tools in dev builds only (testers shouldn't stumble into them).
    if (!app.isPackaged && input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
  })

  // Dev helper: OAK_SCREENSHOT=<file.png> captures the window once it has rendered, then quits.
  // OAK_SCREENSHOT_JS runs a snippet in the page first (e.g. to click through the UI).
  const shot = process.env.OAK_SCREENSHOT
  if (shot) {
    win.webContents.on('did-fail-load', (_e, code, description, url) => console.log('screenshot load failed:', code, description, url))
    win.webContents.on('render-process-gone', (_e, details) => console.log('screenshot renderer exited:', details))
    win.webContents.once('dom-ready', () => console.log('screenshot DOM ready'))
    // Surface page errors and warnings in the helper's output.
    win.webContents.on('console-message', (...args: unknown[]) => {
      // Newer Electron passes one event object, older ones (event, level, message): accept both.
      const e = args[0] as { level?: string | number; message?: string }
      const level = e.level ?? args[1]
      const message = e.message ?? String(args[2])
      if (level === 'error' || level === 'warning' || level === 3 || level === 2) console.log(`page ${level}: ${message.slice(0, 400)}`)
    })
    win.webContents.once('did-finish-load', () => {
      console.log('screenshot loaded')
      setTimeout(async () => {
        // OAK_SCREENSHOT_KEYS="Tab,Down,Shift+Tab" sends real keystrokes and logs where focus lands.
        for (const combo of (process.env.OAK_SCREENSHOT_KEYS ?? '').split(',').filter(Boolean)) {
          // "Wheel:<dx>:<dy>@<x>:<y>" scrolls with a real mouse wheel at that point (dx < 0 = right).
          // "Click@<x>:<y>", "RightClick@<x>:<y>", "Control+Click@<x>:<y>": real mouse clicks (page coordinates).
          const click = /^((?:\w+\+)*)(Right)?Click@(\d+):(\d+)$/.exec(combo)
          const wheel = /^Wheel:(-?\d+):(-?\d+)@(\d+):(\d+)$/.exec(combo)
          // "Hover@<x>:<y>:<ms>": move the pointer there and wait (tooltips, hover states).
          const hover = /^Hover@(\d+):(\d+):(\d+)$/.exec(combo)
          // "Drag@<x1>:<y1>:<x2>:<y2>": press at the first point, move with the button held, release at the second.
          const drag = /^Drag@(\d+):(\d+):(\d+):(\d+)$/.exec(combo)
          if (drag) {
            const [x1, y1, x2, y2] = drag.slice(1).map(Number)
            win.webContents.sendInputEvent({ type: 'mouseMove', x: x1, y: y1 })
            win.webContents.sendInputEvent({ type: 'mouseDown', x: x1, y: y1, button: 'left', clickCount: 1 })
            for (let i = 1; i <= 8; i++) {
              win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x1 + ((x2 - x1) * i) / 8), y: Math.round(y1 + ((y2 - y1) * i) / 8), modifiers: ['leftbuttondown'] })
              await new Promise((r) => setTimeout(r, 20))
            }
            win.webContents.sendInputEvent({ type: 'mouseUp', x: x2, y: y2, button: 'left', clickCount: 1 })
          } else if (click) {
            const modifiers = click[1].split('+').filter(Boolean).map((m) => m.toLowerCase()) as ('shift' | 'control' | 'alt')[]
            const button = click[2] ? 'right' : 'left'
            const [x, y] = [Number(click[3]), Number(click[4])]
            win.webContents.sendInputEvent({ type: 'mouseMove', x, y, modifiers })
            win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button, clickCount: 1, modifiers })
            win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button, clickCount: 1, modifiers })
          } else if (hover) {
            const [x, y, ms] = hover.slice(1).map(Number)
            win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
            win.webContents.sendInputEvent({ type: 'mouseMove', x: x + 1, y })
            await new Promise((r) => setTimeout(r, ms))
          } else if (wheel) {
            const [deltaX, deltaY, x, y] = wheel.slice(1).map(Number)
            win.webContents.sendInputEvent({ type: 'mouseWheel', x, y, deltaX, deltaY, canScroll: true })
          } else {
            const parts = combo.split('+')
            const keyCode = parts.pop()!
            const modifiers = parts.map((m) => m.toLowerCase()) as ('shift' | 'control' | 'alt')[]
            win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
            if (keyCode.length === 1) win.webContents.sendInputEvent({ type: 'char', keyCode, modifiers })
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
          }
          await new Promise((r) => setTimeout(r, 250))
          const where = await win.webContents.executeJavaScript(
            `(() => { const a = document.activeElement; const pane = a?.closest?.('[data-pane]'); const row = a?.closest?.('[role=row]'); const sel = row ?? a?.querySelector?.('.active, .selected, .active-hunk .hunk-range'); const picked = pane ? pane.querySelectorAll('[data-selected], .dl.picked').length : 0; return (pane?.dataset.pane || a?.className || a?.tagName) + (a?.tagName === 'BUTTON' ? ' [' + a.textContent.trim() + ']' : '') + (sel ? ' → ' + sel.textContent.trim().slice(0, 40) : '') + (picked > 1 ? ' (' + picked + ' selected)' : '') })()`
          )
          console.log(`key ${combo.padEnd(12)} focus: ${where}`)
        }
        const js = process.env.OAK_SCREENSHOT_JS
        if (js) {
          console.log('screenshot js:', await win.webContents.executeJavaScript(js).catch((e) => e))
          await new Promise((r) => setTimeout(r, 1200))
        }
        writeFileSync(shot, (await win.webContents.capturePage()).toPNG())
        app.quit()
      }, Number(process.env.OAK_SCREENSHOT_DELAY ?? 2500))
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function registerIpc() {
  for (const [name, fn] of Object.entries(handlers)) {
    // Long-running operations stream git's output (hooks, --progress) to the window as it arrives.
    const run = (...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(...args)
    ipcMain.handle(`git:${name}`, (e, ...args: unknown[]) =>
      STREAMING.has(name) ? outputSink.run((text) => !e.sender.isDestroyed() && e.sender.send('git-output', text), () => run(...args)) : run(...args)
    )
  }

  // Watches the working tree and tells the renderer when something changed.
  const watchers = new Map<number, FSWatcher>()
  ipcMain.handle('watch', (e, repo: string) => {
    const sender = e.sender
    watchers.get(sender.id)?.close()
    let timer: NodeJS.Timeout | undefined
    let gitTouched = false
    try {
      const w = watch(repo, { recursive: true }, (_ev, file) => {
        const f = (file ?? '').toString().replace(/\\/g, '/')
        if (f === '.git' || f.startsWith('.git/')) {
          if (/^\.git\/(objects|logs)\//.test(f) || f.endsWith('.lock')) return
          gitTouched = true
        } else if (/(^|\/)node_modules\//.test(f)) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (!sender.isDestroyed()) sender.send('repo-changed', { git: gitTouched })
          gitTouched = false
        }, 300)
      })
      w.on('error', () => w.close())
      watchers.set(sender.id, w)
      sender.once('destroyed', () => w.close())
    } catch {
      // watching is best-effort; the UI still refreshes on focus
    }
  })
}

// One Oak at a time: opening a folder from Explorer or `oak <path>` while Oak is running hands the
// path to the open window instead of starting another copy. (Not for the dev screenshot helper,
// which runs alongside a normal session.)
if (!process.env.OAK_SCREENSHOT && !app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', (_e, argv, workingDirectory) => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
  const dir = folderArg(argv, workingDirectory)
  if (dir) win.webContents.send('open-path', dir)
})

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('dev.oak.app')
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
