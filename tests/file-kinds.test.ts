import test from 'node:test'
import assert from 'node:assert/strict'
import { imageMimeType, opensBetterInDefaultApp, RASTER_IMAGE_EXTENSIONS } from '../src/shared/fileKinds.ts'

test('images, documents and archives open in the default app', () => {
  for (const path of ['logo.PNG', 'docs/spec.pdf', 'a/b/report.docx', 'build.zip', 'bin/tool.exe'])
    assert.equal(opensBetterInDefaultApp(path), true, path)
})

test('source, config and text files do not', () => {
  for (const path of ['src/app.ts', 'README.md', 'icon.svg', '.env', 'Makefile', 'notes.txt', 'data.json'])
    assert.equal(opensBetterInDefaultApp(path), false, path)
})

test('images Chromium can draw get their media type, others none', () => {
  assert.equal(imageMimeType('art/Logo.PNG'), 'image/png')
  assert.equal(imageMimeType('photo.jpeg'), 'image/jpeg')
  assert.equal(imageMimeType('favicon.ico'), 'image/x-icon')
  assert.equal(imageMimeType('icon.svg'), 'image/svg+xml')
  for (const path of ['scan.tiff', 'photo.heic', 'design.psd', 'png', 'src/app.ts']) assert.equal(imageMimeType(path), null, path)
  assert.equal(RASTER_IMAGE_EXTENSIONS.has('svg'), false)
})
