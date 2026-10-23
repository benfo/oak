import { spawn } from 'child_process'
import { existsSync, promises as fs } from 'fs'
import { homedir } from 'os'
import path from 'path'
import { shell } from 'electron'
import { git } from './git'
import { isTerminalEditor } from '../shared/gitTools'

export type ConfigScope = 'global' | 'local'

/** Folders searched for executables besides PATH: installs that don't register themselves there. */
function extraFolders(): string[] {
  if (process.platform !== 'win32') return []
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]
  const known = [
    'Microsoft VS Code\\bin',
    'Notepad++',
    'Beyond Compare 5',
    'Beyond Compare 4',
    'KDiff3',
    'Meld',
    'WinMerge',
    'Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\CommonExtensions\\Microsoft\\TeamFoundation\\Team Explorer'
  ]
  return roots.filter((r): r is string => !!r).flatMap((r) => known.map((k) => path.join(r, k)))
}

/** The names from `exes` that resolve to a program on this machine. */
export function findExecutables(exes: string[]): string[] {
  const folders = [...(process.env.PATH ?? '').split(path.delimiter), ...extraFolders()].filter(Boolean)
  const extensions = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').map((e) => e.toLowerCase()) : ['']
  return exes.filter((exe) => folders.some((dir) => extensions.some((ext) => existsSync(path.join(dir, exe + ext)))))
}

/** The config file at one scope. Opening it (create) makes an empty global file when there is none yet. */
export async function configFilePath(repo: string | null, scope: ConfigScope, create = false): Promise<string> {
  if (scope === 'local') {
    if (!repo) throw new Error('No repository is open')
    return path.resolve(repo, (await git(repo, ['rev-parse', '--git-path', 'config'])).trim())
  }
  const home = homedir()
  const xdg = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'git', 'config')
  const classic = path.join(home, '.gitconfig')
  const file = !existsSync(classic) && existsSync(xdg) ? xdg : classic
  if (create && !existsSync(file)) await fs.writeFile(file, '')
  return file
}

/** Opens the config file in the editor git itself would use, or the system default for that file type. */
export async function openConfigFile(repo: string | null, scope: ConfigScope): Promise<string> {
  const file = await configFilePath(repo, scope, true)
  // git() forces GIT_EDITOR=true so commands never block, so ask config instead of `git var`.
  const cwd = scope === 'local' && repo ? repo : homedir()
  const editor = (process.env.GIT_EDITOR || (await git(cwd, ['config', 'core.editor'], { okCodes: [1] }).catch(() => ''))).trim()
  if (!editor || isTerminalEditor(editor)) {
    const error = await shell.openPath(file)
    if (error) throw new Error(error)
    return file
  }
  const child = spawn(`${editor} "${file}"`, { shell: true, detached: true, stdio: 'ignore', windowsHide: true })
  child.on('error', () => void shell.openPath(file))
  child.unref()
  return file
}
