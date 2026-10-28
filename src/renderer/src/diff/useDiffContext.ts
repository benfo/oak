import { useSyncExternalStore } from 'react'
import { getSettings, useSettings } from '../settings'
import { FULL_CONTEXT, isFullContext, lessContext, moreContext } from './diffContext'

/** Session-only context for every diff; null follows Preferences → Diff context. */
let override: number | null = null
const subs = new Set<() => void>()

const subscribe = (fn: () => void) => {
  subs.add(fn)
  return () => void subs.delete(fn)
}

export const getContextLines = () => override ?? getSettings().contextLines

export function useContextLines() {
  const { contextLines } = useSettings()
  return useSyncExternalStore(subscribe, () => override) ?? contextLines
}

function setOverride(value: number | null) {
  override = value
  subs.forEach((fn) => fn())
}

export const setContextLines = (value: number) => setOverride(value)

export const showMoreContext = () => setOverride(moreContext(getContextLines()))
export const showLessContext = () => setOverride(lessContext(getContextLines()))
export const toggleFullContext = () => setOverride(isFullContext(getContextLines()) ? null : FULL_CONTEXT)
