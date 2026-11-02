import { useCallback, useEffect, useState } from 'react'
import type { GitConfigScope } from '../../../main/handlers'
import { api, errorMessage } from '../api'
import { notify } from '../notices'
import { createStore } from './createStore'

/** Bumped after Git settings saves, so views that show config (the status bar's identity) read it again. */
export const gitConfigRevision = createStore(0)

/** Opens the config file in the editor git would use. It may appear behind Oak, so the toast says where it went. */
export async function openRepoOrGlobalConfig(repo: string | null, scope: GitConfigScope) {
  try {
    const file = await api.openGitConfig(repo, scope)
    notify.info(`Opened ${file} in your editor`)
  } catch (e) {
    notify.error(`Could not open the git config: ${errorMessage(e)}`)
  }
}

export type Config = Record<string, string | null>
export interface GitConfig {
  global: Config
  local: Config
}

/** The values of `keys` at global and (when a repository is open) local scope, with a writer that reloads afterwards. */
export function useGitConfig(repo: string | null, keys: readonly string[]) {
  const [config, setConfig] = useState<GitConfig | null>(null)

  const load = useCallback(async () => {
    const [global, local] = await Promise.all([
      api.gitConfigGet(repo, 'global', [...keys]),
      repo ? api.gitConfigGet(repo, 'local', [...keys]) : Promise.resolve<Config>({})
    ])
    return { global, local }
  }, [repo, keys])

  useEffect(() => {
    let stale = false
    load()
      .then((c) => !stale && setConfig(c))
      .catch((e) => notify.error(`Could not read git config: ${errorMessage(e)}`))
    return () => {
      stale = true
    }
  }, [load])

  /** Writes several keys at one scope (an empty value unsets the key). The page updates at once; a failure puts the real values back. */
  const write = useCallback(
    async (scope: GitConfigScope, entries: Record<string, string>) => {
      setConfig(
        (c) =>
          c && { ...c, [scope]: { ...c[scope], ...Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v.trim() || null])) } }
      )
      try {
        for (const [key, value] of Object.entries(entries)) await api.gitConfigSet(repo, scope, key, value)
        gitConfigRevision.set(gitConfigRevision.get() + 1)
      } catch (e) {
        notify.error(`Could not save git config: ${errorMessage(e)}`)
        await load().then(setConfig, () => undefined)
      }
    },
    [repo, load]
  )

  return { config, write }
}
