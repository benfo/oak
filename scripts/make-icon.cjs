// Default: render build/icon.svg to build/icon.png for electron-builder's .ico.
// Optional: electron scripts/make-icon.cjs input.svg output.png size
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync, copyFileSync } = require('fs')
const { join, resolve } = require('path')

const SIZE = Number(process.argv[4] ?? 512)
if (!Number.isInteger(SIZE) || SIZE < 16 || SIZE > 4096) throw new Error('Image size must be an integer from 16 to 4096.')
const source = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, '../build/icon.svg')
const target = process.argv[3] ? resolve(process.argv[3]) : join(__dirname, '../build/icon.png')
const svg = readFileSync(source, 'utf8')
if (!process.argv[2]) copyFileSync(source, join(__dirname, '../website/public/icon.svg'))

app.disableHardwareAcceleration()
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })
  let loaded = false
  let done = false
  win.webContents.once('did-finish-load', () =>
    setTimeout(() => {
      loaded = true
      win.webContents.invalidate()
    }, 300)
  )
  win.webContents.on('paint', (_e, _dirty, image) => {
    if (!loaded || done || image.getSize().width < SIZE) return
    done = true
    writeFileSync(target, image.resize({ width: SIZE, height: SIZE }).toPNG())
    console.log('wrote', target, `${SIZE}x${SIZE}`)
    app.quit()
  })
  const html = `<html><head><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%}</style></head><body>${svg}</body></html>`
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
})
