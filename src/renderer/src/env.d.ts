// Makes this file a module, so the `declare global` below augments the real Window type.
export {}

declare global {
  interface Window {
    bridge: {
      invoke(name: string, ...args: unknown[]): Promise<unknown>
      watch(repo: string): Promise<void>
      platform: string
      onGitOutput(cb: (text: string) => void): () => void
      onRepoChanged(cb: (d: { git: boolean }) => void): () => void
      versions: { electron: string; chrome: string }
      setZoom(factor: number): void
      /** A folder opened from Explorer or the `oak` command while Oak was already running. */
      onOpenPath(cb: (dir: string) => void): () => void
      /** Self-update progress (src/main/updater.ts). */
      onUpdateStatus(cb: (s: unknown) => void): () => void
    }
  }
}

