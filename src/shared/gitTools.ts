/** Presets for the git settings Oak offers a picker for. Pure data and helpers, shared by main and renderer. */

export interface ConfigPreset {
  /** Stable id and the value stored in git config. */
  value: string
  label: string
  /** Executable looked for on this machine; omitted when git resolves the tool itself. */
  exe?: string
  /** Extra config written alongside the main key when this preset is chosen. */
  extra?: Record<string, string>
}

export const EDITOR_PRESETS: ConfigPreset[] = [
  { value: 'code --wait', label: 'VS Code', exe: 'code' },
  { value: 'notepad++ -multiInst -notabbar -nosession -noPlugin', label: 'Notepad++', exe: 'notepad++' },
  { value: 'notepad', label: 'Notepad', exe: 'notepad' },
  { value: 'vim', label: 'Vim', exe: 'vim' }
]

export const MERGE_TOOL_PRESETS: ConfigPreset[] = [
  {
    value: 'vscode',
    label: 'VS Code',
    exe: 'code',
    extra: { 'mergetool.vscode.cmd': 'code --wait --merge $REMOTE $LOCAL $BASE $MERGED', 'mergetool.vscode.trustExitCode': 'true' }
  },
  { value: 'bc', label: 'Beyond Compare', exe: 'bcomp' },
  { value: 'kdiff3', label: 'KDiff3', exe: 'kdiff3' },
  { value: 'meld', label: 'Meld', exe: 'meld' },
  { value: 'winmerge', label: 'WinMerge', exe: 'WinMergeU' },
  { value: 'vsdiffmerge', label: 'Visual Studio', exe: 'vsdiffmerge' }
]

export const DIFF_TOOL_PRESETS: ConfigPreset[] = [
  {
    value: 'vscode',
    label: 'VS Code',
    exe: 'code',
    extra: { 'difftool.vscode.cmd': 'code --wait --diff $LOCAL $REMOTE' }
  },
  ...MERGE_TOOL_PRESETS.filter((p) => p.value !== 'vscode')
]

export interface LineEndingOption {
  /** Stored core.autocrlf value; empty means unset. */
  value: string
  label: string
}

export const LINE_ENDINGS: LineEndingOption[] = [
  { value: 'true', label: 'LF in the repository, CRLF in files (usual on Windows)' },
  { value: 'input', label: 'LF in the repository, files left as they are (usual on macOS and Linux)' },
  { value: 'false', label: 'Leave line endings alone' }
]

export function findPreset(presets: ConfigPreset[], value: string | null | undefined): ConfigPreset | undefined {
  return value ? presets.find((p) => p.value === value) : undefined
}

/** Editors that need a terminal; opening a file with them from a GUI would flash and exit. */
export function isTerminalEditor(command: string): boolean {
  const first = command.trim().match(/^"([^"]+)"|^'([^']+)'|^\S+/)
  const exe = (first?.[1] ?? first?.[2] ?? first?.[0])?.split(/[\\/]/).pop()?.replace(/\.exe$/i, '').toLowerCase()
  return !!exe && ['vim', 'vi', 'nvim', 'nano', 'emacs', 'micro', 'pico'].includes(exe)
}

/** True when a .gitattributes body sets text or eol handling for any pattern. */
export function setsLineEndings(attributes: string): boolean {
  return attributes.split(/\r?\n/).some((line) => {
    const rule = line.trim()
    if (!rule || rule.startsWith('#')) return false
    return rule.split(/\s+/).slice(1).some((attr) => /^(-?text|!text|text=|eol=)/.test(attr))
  })
}
