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
  assert.doesNotMatch(html, /utm_source=organic/)
})

test('content pages have crawlable homepage links and self canonicals', () => {
  for (const path of ['recruiting-guide', 'recruiting-news']) {
    assert.ok(file('index.html').includes('href="/' + path + '/"'))
    const html = file(path + '/index.html')
    assert.ok(html.includes('rel="canonical" href="https://orbit-reaches.com/' + path + '/"'))
    assert.doesNotMatch(html, /<meta[^>]+(?:noindex|http-equiv="refresh")/i)
  }
})
test('every sitemap destination exists and is not noindex', () => {
  for (const [, url] of file('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const parsed = new URL(url)
    assert.equal(parsed.origin, 'https://orbit-reaches.com')
    assert.equal(parsed.search, '')
    const html = file(parsed.pathname.slice(1) + 'index.html')
    assert.doesNotMatch(html, /<meta[^>]+noindex/i)
  }
  assert.match(file('continue/index.html'), /name="robots" content="noindex,nofollow"/)
})
