import { useSyncExternalStore } from 'react'
import { api } from '../api'
import { repoIdentity, type Identity } from '../../../shared/identity'
import { gitConfigRevision } from './useGitConfig'
import { useRefreshed } from './useRefreshed'

const KEYS = ['user.name', 'user.email']

/**
 * The identity a commit in this repository carries (see `repoIdentity`), or null until read. It is read
 * again when Git settings saves and on the usual schedule (see `useRefreshed`).
 */
export function useIdentity(path: string): Identity | null {
  const revision = useSyncExternalStore(gitConfigRevision.subscribe, gitConfigRevision.get)
  return useRefreshed(async () => {
    const [global, local] = await Promise.all([api.gitConfigGet(path, 'global', KEYS), api.gitConfigGet(path, 'local', KEYS)])
    return repoIdentity(global, local)
  }, [path, revision])
}
