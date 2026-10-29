import { useEffect, type RefObject } from 'react'

/**
 * Publishes the toolbar's height on its `.diff-wrap` as `--diff-toolbar-height`, so things placed below it (the find bar)
 * follow it as it wraps onto more rows, without anyone knowing a row height.
 */
export function usePublishToolbarHeight(toolbar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = toolbar.current
    const wrap = el?.closest<HTMLElement>('.diff-wrap')
    if (!el || !wrap) return
    const publish = () => wrap.style.setProperty('--diff-toolbar-height', `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      wrap.style.removeProperty('--diff-toolbar-height')
    }
  }, [toolbar])
}
