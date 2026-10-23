import type { FileDiff } from './diff'

/** A run of highlighted text. `c` is a CSS colour (a `var(--syntax-…)`); absent = the normal text colour. */
export interface Span {
  t: string
  c?: string
}

/** Per hunk, per line: the line's spans, or null where a line isn't highlighted (notes). */
export type DiffTokens = (Span[] | null)[][]

/** Extensions and file names Shiki doesn't know by id or alias. */
const EXTRA: Record<string, string> = {
  h: 'c',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hh: 'cpp',
  htm: 'html',
  xhtml: 'html',
  svg: 'xml',
  csproj: 'xml',
  fsproj: 'xml',
  vbproj: 'xml',
  props: 'xml',
  targets: 'xml',
  config: 'xml',
  xaml: 'xml',
  resx: 'xml',
  plist: 'xml',
  sln: 'ini',
  editorconfig: 'ini',
  gitconfig: 'ini',
  cfg: 'ini',
  conf: 'ini',
  psm1: 'powershell',
  psd1: 'powershell',
  bash: 'shellscript',
  zsh: 'shellscript',
  markdown: 'markdown',
  mkd: 'markdown',
  jsonc: 'jsonc',
  json5: 'json5',
  lock: 'json',
  babelrc: 'json',
  eslintrc: 'json',
  prettierrc: 'json',
  pyi: 'python',
  pyw: 'python',
  rake: 'ruby',
  gemspec: 'ruby',
  kts: 'kotlin',
  cshtml: 'razor',
  razor: 'razor',
  tsbuildinfo: 'json',
  gitattributes: 'ini',
  gitignore: 'ini',
  dockerignore: 'ini',
  npmrc: 'ini',
  env: 'dotenv',
  tf: 'terraform'
}
const NAMES: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'make',
  gnumakefile: 'make',
  justfile: 'just',
  gemfile: 'ruby',
  rakefile: 'ruby',
  codeowners: 'codeowners',
  'cmakelists.txt': 'cmake',
  'tsconfig.json': 'jsonc',
  'jsconfig.json': 'jsonc',
  '.bashrc': 'shellscript',
  '.zshrc': 'shellscript',
  '.profile': 'shellscript'
}

/**
 * A language id (or alias) for Shiki from a file path, or null if it has none we recognise.
 * `known` is the set of ids/aliases Shiki bundles; the worker passes it, tests can too.
 */
export function languageFor(path: string, known: (id: string) => boolean): string | null {
  const name = path.split('/').pop()!.toLowerCase()
  if (NAMES[name]) return NAMES[name]
  if (name.startsWith('dockerfile') || name.endsWith('.dockerfile')) return 'docker'
  if (name.startsWith('.env')) return 'dotenv'
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  const ext = name.slice(dot + 1)
  if (EXTRA[ext]) return EXTRA[ext]
  return known(ext) ? ext : null
}

/** The file a diff is about: the new path, or the old one for a deletion. */
export function diffPath(diff: FileDiff): string | null {
  const strip = (p: string) => p.replace(/^"|"$/g, '').replace(/\t.*$/, '')
  const next = diff.header.find((l) => l.startsWith('+++ '))
  if (next && next !== '+++ /dev/null') return strip(next.slice(4)).replace(/^b\//, '')
  const prev = diff.header.find((l) => l.startsWith('--- '))
  if (prev && prev !== '--- /dev/null') return strip(prev.slice(4)).replace(/^a\//, '')
  const head = diff.header[0] ?? ''
  const cc = /^diff --(?:cc|combined) (.+)$/.exec(head)
  if (cc) return cc[1]
  const git = /^diff --git a\/.+ b\/(.+)$/.exec(head)
  return git ? git[1] : null
}

/**
 * The code to highlight: for each hunk, its old side (context + deletions) and its new side
 * (context + additions), each as one block so the grammar sees consecutive lines of the file.
 * Only the first `hunkCount` hunks (the rendered ones).
 */
export function diffBlocks(diff: FileDiff, hunkCount = diff.hunks.length): string[] {
  const blocks: string[] = []
  for (const h of diff.hunks.slice(0, hunkCount)) {
    blocks.push(
      h.lines
        .filter((l) => l.type === 'ctx' || l.type === 'del')
        .map((l) => l.text)
        .join('\n'),
      h.lines
        .filter((l) => l.type === 'ctx' || l.type === 'add')
        .map((l) => l.text)
        .join('\n')
    )
  }
  return blocks
}

/** Maps highlighted blocks (from diffBlocks) back onto each hunk's lines. Context lines use the new side. */
export function assignTokens(diff: FileDiff, blocks: Span[][][]): DiffTokens {
  return diff.hunks.slice(0, blocks.length / 2).map((h, hi) => {
    const oldSide = blocks[hi * 2]
    const newSide = blocks[hi * 2 + 1]
    let o = 0
    let n = 0
    return h.lines.map((l) => {
      if (l.type === 'del') return oldSide[o++] ?? null
      if (l.type === 'add') return newSide[n++] ?? null
      if (l.type === 'ctx') {
        o++
        return newSide[n++] ?? null
      }
      return null
    })
  })
}
