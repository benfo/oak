const URLS = import.meta.glob<string>('./material/*.svg', { query: '?url', import: 'default', eager: true })

/** The bundled image for a Material icon id (the file name without `.svg`). */
export const materialIconUrl = (id: string): string | undefined => URLS[`./material/${id}.svg`]
