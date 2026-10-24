import { useSyncExternalStore } from 'react'
import type { RepoCtx } from '../useRepo'
import { createStore } from '../ui'

const store = createStore<RepoCtx | null>(null)

/** Lets app-level screens such as Preferences work on the open repository. RepoView publishes it. */
export const publishActiveRepo = (r: RepoCtx | null) => store.set(r)

export const useActiveRepo = () => useSyncExternalStore(store.subscribe, store.get)
