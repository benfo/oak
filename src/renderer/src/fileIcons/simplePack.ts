import type { FileIconPack } from './pack'

/** { code: 'ts js' } -> { ts: 'code', js: 'code' } */
const group = (id: string, names: string) => Object.fromEntries(names.split(' ').map((name) => [name, id]))

export const SIMPLE_ICON_IDS = [
  'file',
  'folder',
  'folder-open',
  'code',
  'json',
  'text',
  'config',
  'image',
  'archive',
  'terminal',
  'spreadsheet',
  'database',
  'audio',
  'video',
  'font',
  'key',
  'lock',
  'package',
  'git'
] as const
export type SimpleIconId = (typeof SIMPLE_ICON_IDS)[number]

/** Monochrome pack: one glyph per kind of file, drawn in the text colour. */
export const SIMPLE_PACK: FileIconPack = {
  file: 'file',
  folder: 'folder',
  folderOpen: 'folder-open',
  filenames: {
    ...group('package', 'package.json package-lock.json'),
    ...group('lock', 'yarn.lock pnpm-lock.yaml'),
    ...group('git', '.gitignore .gitattributes .gitmodules .gitkeep'),
    ...group('config', 'dockerfile .dockerignore docker-compose.yml docker-compose.yaml compose.yml compose.yaml .editorconfig .babelrc'),
    ...group('terminal', 'makefile'),
    ...group('text', 'readme license license.md license.txt'),
    ...group('key', '.npmrc .nvmrc .node-version')
  },
  prefixes: {
    '.env': 'key',
    '.eslintrc': 'config',
    '.prettierrc': 'config'
  },
  extensions: {
    ...group(
      'code',
      'ts tsx mts cts js jsx mjs cjs html htm css scss sass less vue svelte astro d.ts test.ts spec.ts test.tsx spec.tsx test.js spec.js'
    ),
    ...group(
      'code',
      'py cs java go rs rb php c h cpp cc hpp kt swift dart lua pl pm jl clj cljs cljc erl hrl fs fsx fsi coffee zig vim gradle'
    ),
    ...group('code', 'graphql gql prisma proto tf'),
    ...group('json', 'json jsonc json5'),
    ...group('text', 'md mdx txt log pdf doc docx'),
    ...group('config', 'yml yaml toml ini conf xml config.ts config.js config.mjs config.cjs'),
    ...group('image', 'png jpg jpeg gif webp avif bmp ico svg'),
    ...group('archive', 'zip gz tgz tar 7z rar'),
    ...group('terminal', 'sh bash zsh bat cmd ps1'),
    ...group('spreadsheet', 'csv'),
    ...group('database', 'sql'),
    ...group('audio', 'mp3 wav ogg'),
    ...group('video', 'mp4 mov webm'),
    ...group('font', 'woff woff2 ttf otf'),
    ...group('key', 'pem crt key'),
    ...group('lock', 'lock')
  }
}
