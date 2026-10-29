/** Editors Oak can open files in (Preferences > External tools). Pure data and helpers, shared by main and renderer. */

export interface EditorPreset {
  /** Stable id stored in settings. */
  id: string
  label: string
  /** Executable looked for on this machine. */
  exe: string
  /** Arguments that open `file`, at `line` when given. */
  args: (file: string, line?: number) => string[]
}

const gotoColon = (file: string, line?: number) => [line ? `${file}:${line}` : file]

export const EDITOR_PRESETS: EditorPreset[] = [
  { id: 'vscode', label: 'VS Code', exe: 'code', args: (f, l) => ['--goto', ...gotoColon(f, l)] },
  { id: 'cursor', label: 'Cursor', exe: 'cursor', args: (f, l) => ['--goto', ...gotoColon(f, l)] },
  { id: 'sublime', label: 'Sublime Text', exe: 'subl', args: gotoColon },
  { id: 'notepad++', label: 'Notepad++', exe: 'notepad++', args: (f, l) => (l ? [`-n${l}`, f] : [f]) }
]

/** Choose from the installed presets, else the system default app. */
export const AUTO_EDITOR = ''
/** Stored instead of a preset id when the user types their own command. */
export const CUSTOM_EDITOR = 'custom'

export const findEditor = (id: string) => EDITOR_PRESETS.find((p) => p.id === id)

/** Expands a custom command: `{file}` is the full path, `{line}` the line (1 when there is none). The path is wrapped in double quotes. */
export function customEditorCommand(template: string, file: string, line?: number): string {
  return template.replaceAll('{file}', `"${file}"`).replaceAll('{line}', String(line ?? 1))
}
