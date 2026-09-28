import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = new URL('../', import.meta.url)
const html = readFileSync(new URL('index.html', root), 'utf8')
assert(html.includes('src="media/orbit-demo.mp4"'))
assert(html.includes('poster="media/orbit-demo-poster.jpg"'))
const fixture = html
  .replace('src="media/orbit-demo.mp4"', `src="data:video/mp4;base64,${readFileSync(new URL('media/orbit-demo.mp4', root)).toString('base64')}"`)
  .replace('poster="media/orbit-demo-poster.jpg"', `poster="data:image/jpeg;base64,${readFileSync(new URL('media/orbit-demo-poster.jpg', root)).toString('base64')}"`)
const release = { tag_name: 'v9.9.9', assets: [
  { name: 'Orbit-9.9.9-arm64.dmg', size: 1000000, browser_download_url: 'https://example.test/mac-arm64.dmg' },
  { name: 'Orbit-9.9.9.dmg', size: 1000000, browser_download_url: 'https://example.test/mac-intel.dmg' },
  { name: 'Orbit-9.9.9.exe', size: 1000000, browser_download_url: 'https://example.test/windows.exe' }
] }
const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
const phoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] })
async function pageFor(width, { reduced = false, phone = false, saveData = false, releaseFailure = false, arch = 'arm' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 940 }, deviceScaleFactor: 2, userAgent: phone ? phoneUA : macUA, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  // Exercise the shipped HTML+JS and real packaged media bytes without relying
  // on an external service or a network request to localhost.
  await page.evaluate(({ release, releaseFailure, saveData, arch }) => {
    window.fetch = async () => new Response(JSON.stringify(release), { status: releaseFailure ? 503 : 200, headers: { 'content-type': 'application/json' } })
    Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { platform: 'macOS', getHighEntropyValues: async () => ({ architecture: arch }) } })
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData } })
  }, { release, releaseFailure, saveData, arch })
  await page.setContent(fixture)
  await page.waitForFunction(() => document.documentElement.dataset.downloadReady === 'true')
  return { context, page, errors }
}
try {
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
    const { context, page, errors } = await pageFor(width, { phone: width < 800 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: horizontal overflow`)
    assert.equal(await page.locator('.work-card').count(), 4)
    for (const card of await page.locator('.work-card').all()) {
      assert.equal(await card.evaluate(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight), false, `${width}: clipped workflow card`)
    }
    if (width >= 1024) {
      assert(await page.locator('h1').evaluate(el => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight) < 3.2), `${width}: heading exceeds 3 lines`)
      assert.match(await page.locator('#dl-btn').getAttribute('href'), /mac-arm64\.dmg$/)
    } else {
      assert.equal(await page.locator('#dl-btn').getAttribute('href'), '#demo')
      assert.equal(await page.locator('.hero-copy .btn-secondary').getAttribute('href'), '#orbit-stage')
    }
    await page.waitForFunction(() => document.querySelector('video').videoWidth > 0)
    assert.equal(await page.locator('video').evaluate(el => el.controls), true)
    const raster = await page.locator('video').evaluate(el => ({ display: el.getBoundingClientRect().width * devicePixelRatio, source: el.videoWidth, transform: getComputedStyle(el).transform }))
    assert(raster.display <= raster.source + 2, `${width}: recording is enlarged beyond source pixels`)
    assert.equal(raster.transform, 'none')
    const caption = await page.locator('.video-caption').evaluate(el => ({ box: el.getBoundingClientRect().toJSON(), parent: el.parentElement.getBoundingClientRect().toJSON() }))
    assert(caption.box.bottom <= caption.parent.bottom + 1, `${width}: video caption is cropped`)
    assert.equal(errors.length, 0, errors.join('\n'))
    await context.close()
  }
  const motion = await pageFor(1440)
  await motion.page.locator('#replay-flow').click()
  for (const step of [1, 2, 3]) {
    await motion.page.waitForFunction(step => document.getElementById('orbit-stage').dataset.step === String(step), step, { timeout: 4500 })
    assert.equal(await motion.page.locator('#orbit-stage').isVisible(), true, `phase ${step} vanished`)
  }
  await motion.page.locator('#pause-flow').click()
  const before = await motion.page.locator('#satellite-a').getAttribute('cx')
  await motion.page.waitForTimeout(250)
  assert.equal(await motion.page.locator('#satellite-a').getAttribute('cx'), before, 'pause does not pause')
  await motion.page.locator('[data-work-step="2"]').click()
  assert.equal(await motion.page.locator('#orbit-stage').getAttribute('data-step'), '2')
  await motion.page.locator('#replay-flow').click()
  assert.equal(await motion.page.locator('#orbit-stage').getAttribute('data-step'), '0')
  assert.equal(motion.errors.length, 0)
  await motion.context.close()
  for (const opts of [{ reduced: true }, { saveData: true }]) {
    const { page, context } = await pageFor(1440, opts)
    assert.equal(await page.locator('video').evaluate(el => el.autoplay), false)
    if (opts.reduced) {
      assert.equal(await page.locator('#orbit-stage').getAttribute('data-motion'), 'reduced')
      assert.equal(await page.locator('#pause-flow').isDisabled(), true)
      await page.locator('[data-work-step="3"]').click()
      assert.equal(await page.locator('#orbit-stage').getAttribute('data-step'), '3')
    }
    await context.close()
  }
  const fallback = await pageFor(1440, { releaseFailure: true })
  assert.match(await fallback.page.locator('#dl-btn').getAttribute('href'), /releases\/latest$/)
  assert.match(await fallback.page.locator('#dl-meta').innerText(), /300 free Orbit Credits/)
  await fallback.context.close()
  console.log('Hero quality: 7 widths at DPR 2, 4 complete animation phases, controls, reduced motion, source-pixel budget, caption bounds and download fallback passed.')
} finally { await browser.close() }
