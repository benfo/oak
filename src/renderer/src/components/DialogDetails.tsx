export interface DialogDetails {
  items?: { lead: string; text: string }[]
  warning?: string
}

/** The list and warning a confirm or prompt dialog can show between its message and its controls. */
export function DialogDetailsView({ items, warning }: DialogDetails) {
  return (
    <>
      {items && items.length > 0 && (
        <ul className="modal-list">
          {items.map((item) => (
            <li key={item.lead} className="modal-list-row">
              <code>{item.lead}</code>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
      {warning && <p className="modal-warning">{warning}</p>}
    </>
  )
}
