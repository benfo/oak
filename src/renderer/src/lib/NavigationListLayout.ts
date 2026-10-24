import { ListLayout } from 'react-aria-components'

/** Keep React Aria's paging, disabled-item skipping, selection and virtualization.
 * Its keyboard delegate reads this layout's visible rect to calculate a page.
 * Only the synchronous Ctrl+D/U alias dispatch uses a half-height keyboard page.
 */
export class NavigationListLayout extends ListLayout<unknown> {
  private halfPage = false

  withHalfPage = (run: () => void) => {
    const previous = this.halfPage
    this.halfPage = true
    try {
      run()
    } finally {
      this.halfPage = previous
    }
  }

  getVisibleRect() {
    const rect = super.getVisibleRect()
    if (!this.halfPage) return rect
    const page = rect.copy()
    // The library subtracts one row when calculating a page destination.
    page.height = Math.min(rect.height, rect.height / 2 + (this.rowSize ?? 0))
    return page
  }
}
