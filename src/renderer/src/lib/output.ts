const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g

/**
 * Git/hook output as displayable lines: ANSI colour codes stripped, and carriage-return
 * progress updates ("Receiving objects: 45%\r...") collapsed to their latest state.
 */
export function outputLines(text: string): string[] {
  return text
    .replace(ANSI, '')
    .split('\n')
    .map(
      (l) =>
        l
          .split('\r')
          .filter((s) => s.trim())
          .pop() ?? ''
    )
    .filter((l, i, all) => l.trim() || i < all.length - 1)
}

export function lastOutputLine(text: string) {
  const lines = outputLines(text).filter((l) => l.trim())
  return lines[lines.length - 1]?.trim() ?? ''
}

export function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
