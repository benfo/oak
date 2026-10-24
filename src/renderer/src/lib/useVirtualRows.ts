import { useVirtualizer, type VirtualizerOptions } from '@tanstack/react-virtual'

type Options = Pick<VirtualizerOptions<HTMLElement, Element>, 'count' | 'getScrollElement' | 'estimateSize' | 'overscan' | 'getItemKey'>

/**
 * Windows a long list of rows. Render only `items` (or the rows from `start` to `end`) inside a wrapper with the
 * `spacer` padding, which stands in for the rows left out so the scrollbar and positions stay true.
 */
export function useVirtualRows(options: Options) {
  const virtual = useVirtualizer(options)
  const items = virtual.getVirtualItems()
  const first = items[0]
  const last = items[items.length - 1]
  return {
    virtual,
    items,
    start: first?.index ?? 0,
    end: (last?.index ?? -1) + 1,
    spacer: { paddingTop: first?.start ?? 0, paddingBottom: last ? virtual.getTotalSize() - last.end : 0 }
  }
}
