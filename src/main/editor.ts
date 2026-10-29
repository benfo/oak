import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { shell } from 'electron'
import { AUTO_EDITOR, CUSTOM_EDITOR, EDITOR_PRESETS, customEditorCommand, findEditor } from '../shared/editors'
import { findExecutables } from './gitConfigFiles'

export interface EditorChoice {
  /** A preset id, `AUTO_EDITOR` or `CUSTOM_EDITOR`. */
  id: string
  /** The command template used when `id` is `CUSTOM_EDITOR`. */
  command: string
}

const quote = (arg: string) => (/[\s"&|<>^()]/.test(arg) ? `"${arg.replaceAll('"', '')}"` : arg)

/** The first preset (in list order) whose program is installed. */
function firstInstalledEditor() {
  const installed = new Set(findExecutables(EDITOR_PRESETS.map((p) => p.exe)))
  return EDITOR_PRESETS.find((p) => installed.has(p.exe))
}

function launch(command: string, onError: (e: Error) => void) {
  const child = spawn(command, { shell: true, detached: true, stdio: 'ignore', windowsHide: true })
  child.on('error', onError)
  child.unref()
}

/**
 * Opens a file (at a line) or, without `file`, the repository folder in the chosen editor.
 * Automatic picks the first installed preset and falls back to the system default app for a file.
 */
export async function openInEditor(repo: string, file: string | null, line: number | undefined, choice: EditorChoice) {
  const target = file ? path.join(repo, file) : repo
  if (file && !existsSync(target)) throw new Error(`${file} is not in the working copy`)
  const fallback = async () => {
    const error = file ? await shell.openPath(target) : 'No supported editor found. Choose one in Preferences > External tools.'
    if (error) throw new Error(error)
  }

  if (choice.id === CUSTOM_EDITOR) {
    if (!choice.command.trim()) throw new Error('Enter an editor command in Preferences > External tools.')
    launch(customEditorCommand(choice.command, target, file ? line : undefined), () => void shell.openPath(target))
    return
  }

  const preset = choice.id === AUTO_EDITOR ? firstInstalledEditor() : findEditor(choice.id)
  if (!preset) return fallback()
  const args = file ? preset.args(target, line) : [target]
  launch([preset.exe, ...args].map(quote).join(' '), () => void fallback())
}
