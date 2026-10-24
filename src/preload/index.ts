import { contextBridge, ipcRenderer, webFrame, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('bridge', {
  invoke: (name: string, ...args: unknown[]) => ipcRenderer.invoke(`git:${name}`, ...args),
  watch: (repo: string) => ipcRenderer.invoke('watch', repo),
  platform: process.platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  setZoom: (factor: number) => webFrame.setZoomFactor(factor),
  onGitOutput: (cb: (text: string) => void) => {
    const listener = (_e: IpcRendererEvent, text: string) => cb(text)
    ipcRenderer.on('git-output', listener)
    return () => {
      ipcRenderer.removeListener('git-output', listener)
    }
  },
  onOpenPath: (cb: (dir: string) => void) => {
    const listener = (_e: IpcRendererEvent, dir: string) => cb(dir)
    ipcRenderer.on('open-path', listener)
    return () => {
      ipcRenderer.removeListener('open-path', listener)
    }
  },
  onUpdateStatus: (cb: (s: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, s: unknown) => cb(s)
    ipcRenderer.on('update-status', listener)
    return () => {
      ipcRenderer.removeListener('update-status', listener)
    }
  },
  onRepoChanged: (cb: (d: { git: boolean }) => void) => {
    const listener = (_e: IpcRendererEvent, d: { git: boolean }) => cb(d)
    ipcRenderer.on('repo-changed', listener)
    return () => {
      ipcRenderer.removeListener('repo-changed', listener)
    }
  }
})
