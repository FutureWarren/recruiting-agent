import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const file = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
test('sitemap publishes only canonical discoverable pages', () => {
  const xml = file('sitemap.xml')
  for(const path of ['/', '/pricing/', '/recruiting-guide/']) {
    assert.ok(xml.includes('https://orbit-reaches.com' + path + '</loc>'))
  }
  assert.ok(xml.includes('https://orbit-reaches.com/recruiting-news/</loc>'))
  assert.ok(!xml.includes('/unsubscribe/'))

  assert.ok(!xml.includes('/continue/'))
})
test('robots points crawlers at sitemap', () => {
  assert.match(file('robots.txt'), /Sitemap: https:\/\/orbit-reaches\.com\/sitemap\.xml/)
})
test('guide includes visible value and canonical page', () => {
  const html=file('recruiting-guide/index.html')
  assert.match(html,/cold email/i)
  assert.match(html,/coffee chats/i)
  assert.match(html, /rel="canonical" href="https:\/\/orbit-reaches\.com\/recruiting-guide\/"/)
  assert.match(html, /utm_source=organic/)
})
