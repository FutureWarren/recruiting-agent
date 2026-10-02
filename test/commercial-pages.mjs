import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { existsSync, readFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contract = JSON.parse(readFileSync(resolve(root, 'pricing/credit-v2.json'), 'utf8'))
const server = createServer((req, res) => {
  let pathname
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { res.writeHead(400).end(); return }
  const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname))
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.setHeader('content-type', ({'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json'})[extname(file)] || 'application/octet-stream')
  res.end(readFileSync(file))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] })
const paths = ['/pricing/', '/terms/', '/privacy/', '/refunds/', '/support/']
const expected = {
  '/pricing/': ['Available now for Apple Silicon Mac (M1 and later).', 'Windows, Intel Macs, phones and tablets are not supported.', '100 free Orbit Credits', '2 + 3 + 5 = 10 Orbit Credits', '580 Orbit Credits', 'before an email is sent', 'Stripe'],
  '/terms/': ['Operated by Angelic', 'Stripe', 'renew automatically', 'Credit V2', '2 credits', '3 for contact', '5 for completed outreach'],
  '/privacy/': ['Stripe', 'Google', 'Alibaba Cloud', 'Apollo.io'],
  '/refunds/': ['Automatic renewal', 'Stripe', 'Canceling a subscription'],
  '/support/': ['Supported computers', 'Available now for Apple Silicon Mac (M1 and later).', 'Windows, Intel Macs, phones and tablets are not supported.', 'lw3405@nyu.edu', 'Credits did not update']
}
const errors = []
const stale = /one credit (?:is|is charged)|pay for completed personalized outreach|\b30 free credits\b/i
mkdirSync(resolve(root, 'artifacts'), { recursive: true })
try {
  assert.equal(contract.schemaVersion, 2)
  assert.equal(contract.denominationScale, 10)
  assert.equal(Object.values(contract.metering).reduce((a,b) => a+b, 0), 10)
  for (const path of paths) {
    for (const width of [320, 390, 768, 1280, 1440]) {
      const page = await browser.newPage({ viewport: {width, height:900} })
      page.on('pageerror', e => errors.push(e.message))
      const response = await page.goto(base + path)
      assert.ok(response.ok(), path)
      const body = await page.locator('body').innerText()
      assert.doesNotMatch(body, stale, `${path} has a retired credit claim`)
      for (const text of expected[path]) assert.ok(body.includes(text), `${path}: missing ${text}`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} overflow at ${width}`)
      if (path === '/pricing/') {
        assert.equal(await page.locator('[data-plan]').count(), contract.plans.length)
        for (const plan of contract.plans) {
          const card = page.locator(`[data-plan="${plan.id}"]`)
          assert.equal(await card.getAttribute('data-credits'), String(plan.credits))
          assert.equal(await card.getAttribute('data-price-usd'), String(plan.priceUsd))
          assert.equal(await card.getAttribute('data-period-months'), plan.periodMonths == null ? '' : String(plan.periodMonths))
          assert.equal(await card.locator('h2').innerText(), plan.name)
          assert.equal(await card.locator('.price strong').innerText(), '$' + plan.priceUsd)
          assert.ok((await card.locator('.credits').innerText()).includes(plan.credits.toLocaleString('en-US') + ' Orbit Credits'))
          const interval = plan.periodMonths === 3 ? 'per three-month period' : plan.periodMonths === 1 ? 'each month' : 'to start'
          assert.ok((await card.locator('.credits').innerText()).includes(interval))
        }
        for (const [kind, cost] of Object.entries(contract.metering)) {
          const stage = page.locator(`[data-credit-kind="${kind}"]`)
          assert.equal(await stage.getAttribute('data-credit-cost'), String(cost))
          assert.ok((await stage.locator('.stage-price').innerText()).startsWith(String(cost)))
        }
        await page.locator('.credit-faq details').first().locator('summary').click()
        assert.equal(await page.locator('.credit-faq details').first().getAttribute('open'), '')
        assert.ok((await page.locator('.credit-faq details').first().innerText()).includes('not a free-research mode'))
        if (width === 390 || width === 1440) {
          await page.evaluate(() => scrollTo(0, 0))
          await page.waitForTimeout(100)
          await page.screenshot({path:resolve(root, 'artifacts', `pricing-${width}.png`), fullPage:true})
        }
      }
      for (const href of await page.locator('a[href^="/"]').evaluateAll(els => els.map(e => e.getAttribute('href')))) {
        const url = new URL(href, base)
        const localFile = resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname))
        assert.ok(existsSync(localFile), `${path}: broken link ${href}`)
        if (url.hash) assert.ok(readFileSync(localFile, 'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${path}: broken anchor ${href}`)
      }
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
  console.log('Commercial pages passed: five widths, all five Credit V2 plans, 2/3/5 metering, billing periods, FAQ, links and stale-claim guards.')
} finally {
  await browser.close()
  await new Promise(r => server.close(r))
}
