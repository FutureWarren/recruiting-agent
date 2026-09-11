import { chromium } from 'playwright-core'
import { createServer } from 'http'
import { existsSync, readFileSync } from 'fs'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const exe = process.env.CHROMIUM || undefined
const contentType = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8' }
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local.test').pathname
  const relative = pathname === '/' ? 'index.html' : `${pathname.replace(/^\//, '').replace(/\/$/, '')}/index.html`
  const css = pathname === '/site.css' ? 'site.css' : null
  const file = join(root, css || relative)
  if (!existsSync(file)) { res.statusCode = 404; res.end('Not found'); return }
  res.setHeader('content-type', contentType[extname(file)] || 'application/octet-stream')
  res.end(readFileSync(file))
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] })
const pages = ['/pricing/', '/terms/', '/privacy/', '/refunds/', '/support/']
const expected = {
  '/pricing/': ['$19', '100 credits', '$39', '600 credits', '$149', '3,000 credits', '$99', '1,500 credits'],
  '/terms/': ['Operated by Angelic', 'Paddle', 'renew automatically'],
  '/privacy/': ['Paddle', 'Google', 'Alibaba Cloud', 'Apollo.io'],
  '/refunds/': ['Automatic renewal', 'paddle.net', 'Canceling a subscription'],
  '/support/': ['future@angelic.ai', 'Credits did not update']
}

const failures = []
for (const path of pages) {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    const response = await page.goto(`${base}${path}`)
    const body = await page.locator('body').innerText()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    if (!response?.ok()) failures.push(`${path} did not load`)
    if (overflow) failures.push(`${path} overflows at ${viewport.width}px`)
    for (const text of expected[path]) if (!body.includes(text)) failures.push(`${path} is missing ${text}`)
    const localLinks = await page.locator('a[href^="/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
    for (const href of localLinks) {
      if (href.includes('#')) continue
      const target = href === '/' ? join(root, 'index.html') : join(root, href.replace(/^\//, '').replace(/\/$/, ''), 'index.html')
      if (!existsSync(target)) failures.push(`${path} has broken link ${href}`)
    }
    await page.close()
  }
}

await browser.close()
server.close()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('Commercial pages load, contain the live plan details, link correctly, and fit desktop and mobile viewports.')
