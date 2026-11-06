import { test, expect } from './fixtures'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The folder column truncates from the left with `direction: rtl`, which must not move the leading dot of `.mca/`.
test('file list folder keeps a leading dot in place', async ({ open, small }) => {
  mkdirSync(join(small, '.mca'))
  writeFileSync(join(small, '.mca', 'plan.md'), '# Plan\n')
  const page = await open(small)
  const dir = page.getByRole('row', { name: /plan\.md/ }).locator('.file-dir')
  await expect(dir).toHaveText('.mca/')
  const order = await dir.evaluate((el) => {
    const text = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!
    const x = (i: number) => {
      const range = document.createRange()
      range.setStart(text, i)
      range.setEnd(text, i + 1)
      return range.getBoundingClientRect().left
    }
    return { dot: x(0), m: x(1), slash: x(4) }
  })
  expect(order.dot).toBeLessThan(order.m)
  expect(order.m).toBeLessThan(order.slash)
})
