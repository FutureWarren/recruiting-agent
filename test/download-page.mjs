/**
 * The download page, driven by a real browser pretending to be each system.
 *
 * A Windows student who clicked Download used to get a .dmg — Windows offered
 * to open it in Notepad. Nothing about that looked broken from here: the page
 * rendered, the button worked, the file downloaded. It was only wrong for the
 * half of the visitors nobody had tested as.
 *
 * So this loads the real page in Chromium as each system, with the GitHub API
 * stubbed to a known release, and asserts what the button actually points at.
 *
 *   node test/download-page.mjs                 # against the local index.html
 *   node test/download-page.mjs --live          # against the deployed page
 */
import { chromium } from 'playwright-core'
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const live = process.argv.includes('--live')
// Undefined means "whatever Playwright installed", which is what CI has.
// CHROMIUM points at a preinstalled binary for environments that have one.
const exe = process.env.CHROMIUM || undefined

/** A release shaped exactly like the ones electron-builder publishes. */
const RELEASE = {
  tag_name: 'v9.9.9',
  assets: [
    { name: 'Recruiting-Agent-9.9.9-arm64.dmg', size: 122_000_000, browser_download_url: 'https://x/mac-arm64.dmg' },
    { name: 'Recruiting-Agent-9.9.9.dmg', size: 127_000_000, browser_download_url: 'https://x/mac-x64.dmg' },
    { name: 'Recruiting.Agent.Setup.9.9.9.exe', size: 95_000_000, browser_download_url: 'https://x/win-x64.exe' },
    { name: 'Recruiting.Agent.Setup.9.9.9-arm64.exe', size: 94_000_000, browser_download_url: 'https://x/win-arm64.exe' },
    { name: 'latest-mac.yml', size: 800, browser_download_url: 'https://x/latest-mac.yml' }
  ]
}

/**
 * The real v0.1.19 release, as GitHub actually returned it.
 *
 * It matters because it is not shaped like the synthetic one: electron-builder
 * emitted a SINGLE universal Windows installer with no architecture in its
 * name, so the first version of the arch matching found nothing for
 * Windows-on-ARM and told that student there was no Windows build.
 */
const REAL_RELEASE = {
  tag_name: 'v0.1.19',
  assets: [
    { name: 'latest-mac.yml', size: 856, browser_download_url: 'https://x/latest-mac.yml' },
    { name: 'latest.yml', size: 364, browser_download_url: 'https://x/latest.yml' },
    { name: 'Recruiting-Agent-0.1.19-arm64.dmg', size: 122197241, browser_download_url: 'https://x/mac-arm64.dmg' },
    { name: 'Recruiting-Agent-0.1.19.dmg', size: 127015753, browser_download_url: 'https://x/mac-x64.dmg' },
    { name: 'Recruiting-Agent-Setup-0.1.19.exe', size: 215300785, browser_download_url: 'https://x/win-universal.exe' },
    { name: 'Recruiting-Agent-Setup-0.1.19.exe.blockmap', size: 219207, browser_download_url: 'https://x/win.blockmap' },
    { name: 'Recruiting-Agent-0.1.19-arm64-mac.zip', size: 117165125, browser_download_url: 'https://x/mac-arm64.zip' }
  ]
}

/** Mac shipped first, while Windows safely remains on its last good build. */
const MIXED_RELEASE = {
  tag_name: 'v0.1.35',
  assets: [
    { name: 'Orbit-0.1.35-arm64.dmg', size: 121_000_000, browser_download_url: 'https://x/mac-0135.dmg' },
    { name: 'Orbit-0.1.35.dmg', size: 127_000_000, browser_download_url: 'https://x/mac-x64-0135.dmg' },
    { name: 'Orbit-Setup-0.1.34.exe', size: 212_000_000, browser_download_url: 'https://x/win-0134.exe' }
  ]
}

const UA = {
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  macIntel:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  windowsArm:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // iPadOS 13+ calls itself a Macintosh. The word iPad is nowhere in it, which
  // is exactly why an iPad used to be handed a .dmg.
  ipad:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
}

const failures = []
function check(name, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok ? '' : `\n         got: ${actual}`}`)
  if (!ok) failures.push(name)
}

const html = live ? null : readFileSync(join(here, '..', 'index.html'), 'utf8')
const server = live
  ? null
  : createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end(html)
    })
if (server) await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = live
  ? 'https://orbit-reaches.com/'
  : `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  // --live has to leave the machine, and some environments only reach the
  // internet through a proxy. Ignored when there is none.
  ...(live && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
  args: ['--no-sandbox']
})

async function visit(userAgent, release = RELEASE, arch, touchPoints) {
  const context = await browser.newContext({
    userAgent,
    // The proxy above terminates TLS with its own certificate.
    ...(live ? { ignoreHTTPSErrors: true } : {})
  })
  const page = await context.newPage()
  // Only a touch iPad claims several touch points while calling itself a Mac.
  if (touchPoints !== undefined) {
    await page.addInitScript((n) => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => n })
    }, touchPoints)
  }
  // The release is stubbed so this tests the page, not GitHub's rate limit.
  await page.route('**/api.github.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(release) })
  )
  // Force the reported architecture when a case is about one.
  if (arch) {
    await page.addInitScript((a) => {
      Object.defineProperty(navigator, 'userAgentData', {
        configurable: true,
        get: () => ({
          platform: /Win/.test(navigator.userAgent) ? 'Windows' : 'macOS',
          getHighEntropyValues: async () => ({ architecture: a })
        })
      })
    }, arch)
  }
  await page.goto(base)
  await page.waitForFunction(
    () => document.getElementById('dl-meta').textContent !== 'Apple Silicon Mac · free · no account needed',
    { timeout: 8000 }
  ).catch(() => {})
  const state = await page.evaluate(() => ({
    href: document.getElementById('dl-btn').href,
    label: document.getElementById('dl-btn').textContent.trim(),
    meta: document.getElementById('dl-meta').textContent.trim(),
    alts: [...document.querySelectorAll('#dl-alts .dl-alt')].map((b) => b.textContent.trim()),
    macSteps: !document.getElementById('install-mac').hidden,
    winSteps: !document.getElementById('install-win').hidden,
    // The steps are numbered by a CSS counter. It must be reset ONCE for the
    // whole section: a reset per list restarts the count, and a Mac visitor
    // reads "1, 2, 1, 2". start="3" cannot fix it — counters ignore it.
    counterResets: [...document.querySelectorAll('#download *')].filter(
      (el) => /install/.test(getComputedStyle(el).counterReset || '')
    ).length,
    visibleSteps: [...document.querySelectorAll('#download ol.install')]
      .filter((list) => !list.hidden)
      .flatMap((list) => [...list.querySelectorAll(':scope > li')]).length
  }))
  await context.close()
  return state
}

console.log(`\ndownload page — ${live ? base : 'local index.html'}\n`)

// Launch support is intentionally Apple-Silicon-only. The synthetic release
// deliberately contains historical Windows and Intel assets so this test proves
// the public page cannot accidentally resurrect them.
const win = await visit(UA.windows)
console.log('Windows:')
check('does not offer an unsupported Windows installer', win.href, (h) => !/\.(dmg|exe)$/.test(h))
check('explains current Apple Silicon support', win.meta, (m) => /Apple Silicon Mac only/i.test(m))
check('hides Windows install steps', win.winSteps, false)
check('does not pretend Mac steps apply on Windows', win.macSteps, false)

const mac = await visit(UA.macIntel, RELEASE, 'arm')
console.log('\nApple Silicon macOS:')
check('offers the Apple Silicon .dmg', mac.href, (h) => /arm64.*\.dmg$/.test(h))
check('button says Mac', mac.label, (l) => /Mac/i.test(l))
check('shows the macOS install steps', mac.macSteps, true)
check('hides the old Windows install steps', mac.winSteps, false)
check('does not advertise Windows or Intel alternates', mac.alts.join(' | '), (a) => !/Windows|Intel/i.test(a))

const intel = await visit(UA.macIntel, RELEASE, 'x86')
console.log('\nIntel macOS:')
check('does not hand an Intel Mac an incompatible installer', intel.href, (h) => !/\.(dmg|exe)$/.test(h))
check('explains Apple Silicon requirement', intel.meta, (m) => /Apple Silicon Mac only/i.test(m))
check('hides install steps for unsupported hardware', intel.macSteps, false)

const phone = await visit(UA.iphone)
console.log('\niPhone:')
check('does not offer a desktop installer', phone.href, (h) => !/\.(dmg|exe)$/.test(h))
check('says to reopen on Apple Silicon Mac', phone.meta, (m) => /Apple Silicon Mac/i.test(m))

const ipad = await visit(UA.ipad, RELEASE, undefined, 5)
console.log('\niPad (claims to be a Mac):')
check('is not handed a Mac disk image', ipad.href, (h) => !/\.(dmg|exe)$/.test(h))
check('says to reopen on Apple Silicon Mac', ipad.meta, (m) => /Apple Silicon Mac/i.test(m))

console.log('\nInstall steps:')
check('are numbered by one counter, not one per list', mac.counterResets, 1)
check('run 1..4 on a supported Mac without restarting', mac.visibleSteps, 4)

const other = await visit(UA.linux)
console.log('\nUnrecognised system:')
check('hands out no file by default', other.href, (h) => !/\.(dmg|exe)$/.test(h))
check('states the supported platform', other.meta, (m) => /Apple Silicon Mac only/i.test(m))
check('does not advertise unsupported alternatives', other.alts.join(' | '), (a) => !/Windows|Intel/i.test(a))
check('shows no platform-specific steps', other.macSteps || other.winSteps, false)

const historicalWin = await visit(UA.windows, REAL_RELEASE, 'x86')
console.log('\nWindows, even when a historical release contains an .exe:')
check('still refuses the historical Windows installer', historicalWin.href, (h) => !/\.exe$/.test(h))
check('still states Apple Silicon support only', historicalWin.meta, (m) => /Apple Silicon Mac only/i.test(m))

const mixedMac = await visit(UA.macIntel, MIXED_RELEASE, 'arm')
console.log('\nApple Silicon Mac with a mixed historical release:')
check('uses the supported Mac asset', mixedMac.href, 'https://x/mac-0135.dmg')
check('does not expose the historical Windows alternate', mixedMac.alts.join(' | '), (a) => !/Windows/i.test(a))

await browser.close()
if (server) server.close()

console.log(failures.length ? `\n${failures.length} FAILED\n` : '\nall good\n')
process.exit(failures.length ? 1 : 0)
