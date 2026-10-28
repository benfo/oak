import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { MATERIAL_PACK } from '../src/renderer/src/fileIcons/materialPack.ts'
import { lightVariant, resolveFileIcon } from '../src/renderer/src/fileIcons/pack.ts'

const icon = (path: string) => resolveFileIcon(MATERIAL_PACK, path, 'file')

test('files match by extension, case-insensitively', () => {
  assert.equal(icon('src/App.tsx'), 'react_ts')
  assert.equal(icon('index.HTML'), 'html')
  assert.equal(icon('logo.svg'), 'svg')
})

test('exact file names win over their extension', () => {
  assert.equal(icon('package.json'), 'nodejs')
  assert.equal(icon('app/package.json'), 'nodejs')
  assert.equal(icon('data.json'), 'json')
  assert.equal(icon('.gitignore'), 'git')
  assert.equal(icon('Dockerfile'), 'docker')
  assert.equal(icon('vite.config.ts'), 'vite')
})

test('dotfiles match by name or by family prefix', () => {
  assert.equal(icon('.nvmrc'), 'nodejs')
  assert.equal(icon('.npmrc'), 'npm')
  assert.equal(icon('.env'), 'tune')
  assert.equal(icon('config/.env.production'), 'tune')
  assert.equal(icon('.prettierrc.yaml'), 'prettier')
  assert.equal(icon('.unknownrc'), 'file')
})

test('the longest compound extension wins', () => {
  assert.equal(icon('types.d.ts'), 'typescript-def')
  assert.equal(icon('app.test.ts'), 'test-ts')
  assert.equal(icon('a.b.c.ts'), 'typescript')
  assert.equal(icon('Button.stories.tsx'), 'storybook')
  assert.equal(icon('tailwind.config.js'), 'tailwindcss')
})

test('unknown files and extensionless files fall back to the generic file', () => {
  assert.equal(icon('notes.zzz'), 'file')
  assert.equal(icon('Gemfile'), 'file')
})

test('folders use the open or closed icon whatever their name', () => {
  assert.equal(resolveFileIcon(MATERIAL_PACK, 'src', 'folder'), 'folder')
  assert.equal(resolveFileIcon(MATERIAL_PACK, 'node_modules', 'folder', true), 'folder-open')
})

test('light variants apply only to icons that declare one', () => {
  assert.equal(lightVariant(MATERIAL_PACK, 'toml'), 'toml_light')
  assert.equal(lightVariant(MATERIAL_PACK, 'json'), 'json')
})

test('every icon the pack names is vendored', () => {
  const ids = new Set([
    MATERIAL_PACK.file,
    MATERIAL_PACK.folder,
    MATERIAL_PACK.folderOpen,
    ...Object.values(MATERIAL_PACK.filenames),
    ...Object.values(MATERIAL_PACK.prefixes ?? {}),
    ...Object.values(MATERIAL_PACK.extensions),
    ...Object.keys(MATERIAL_PACK.light ?? {}),
    ...Object.values(MATERIAL_PACK.light ?? {})
  ])
  for (const id of ids)
    assert.ok(existsSync(new URL(`../src/renderer/src/fileIcons/material/${id}.svg`, import.meta.url)), `${id}.svg is missing`)
})
