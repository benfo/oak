import { createStore } from './lib/createStore'
import { routeNotice, type NoticeKind, type NoticeSurface } from '../../shared/notice'

export interface NoticeAction {
  label: string
  run: () => void
}

export interface Notice {
  id: number
  kind: NoticeKind
  text: string
  actions?: NoticeAction[]
  surface: NoticeSurface
}

export type NoticeInput = Omit<Notice, 'id' | 'surface'>

const MAX_VISIBLE = 4

/** Every notice still on screen, whatever its surface; each view filters by `surface`. */
export const noticeStore = createStore<Notice[]>([])
/** True while a status bar is mounted; without one a bar notice falls back to a toast. */
export const barMounted = createStore(false)
let noticeId = 0

export function dismissNotice(id: number) {
  noticeStore.set(noticeStore.get().filter((n) => n.id !== id))
}

/** Say what happened; the routing policy (`shared/notice.ts`) decides where it shows. */
function publish(input: NoticeInput) {
  const routed = routeNotice(input)
  const surface = routed === 'bar' && !barMounted.get() ? 'toast' : routed
  noticeStore.set([...noticeStore.get(), { ...input, id: ++noticeId, surface }].slice(-MAX_VISIBLE))
}

const say = (kind: NoticeKind) => (text: string) => publish({ kind, text })

/** `notify({ kind, text, actions })` in general; `notify.error(text)` and friends for the plain cases. */
export const notify = Object.assign(publish, {
  /** Something failed: a toast that stays until dismissed. */
  error: say('error'),
  /** Something changed or was approximate and the user may need to act on it: a toast that fades. */
  warning: say('warning'),
  /** A result or a hint: a line in the status bar. */
  success: say('success'),
  info: say('info')
})
