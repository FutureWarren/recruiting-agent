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

const UA = {
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  macIntel:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
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
  ? 'https://futurewarren.github.io/recruiting-agent/'
  : `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ['--no-sandbox']
})

async function visit(userAgent) {
  const context = await browser.newContext({ userAgent })
  const page = await context.newPage()
  // The release is stubbed so this tests the page, not GitHub's rate limit.
  await page.route('**/api.github.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(RELEASE) })
  )
  await page.goto(base)
  await page.waitForFunction(
    () => document.getElementById('dl-meta').textContent !== 'Mac and Windows · free · no account needed',
    { timeout: 8000 }
  ).catch(() => {})
  const state = await page.evaluate(() => ({
    href: document.getElementById('dl-btn').href,
    label: document.getElementById('dl-btn').textContent.trim(),
    meta: document.getElementById('dl-meta').textContent.trim(),
    alts: [...document.querySelectorAll('#dl-alts .dl-alt')].map((b) => b.textContent.trim()),
    macSteps: !document.getElementById('install-mac').hidden,
    winSteps: !document.getElementById('install-win').hidden
  }))
  await context.close()
  return state
}

console.log(`\ndownload page — ${live ? base : 'local index.html'}\n`)

// The one that was broken, and the reason this file exists.
const win = await visit(UA.windows)
console.log('Windows:')
check('offers the .exe, not the .dmg', win.href, (h) => h.endsWith('.exe'))
check('button says Windows', win.label, (l) => /Windows/i.test(l))
check('shows the Windows install steps', win.winSteps, true)
check('hides the macOS install steps', win.macSteps, false)
check('offers a way to the Mac build', win.alts.join(' | '), (a) => /Mac/i.test(a))

const mac = await visit(UA.macIntel)
console.log('\nmacOS:')
check('offers a .dmg', mac.href, (h) => h.endsWith('.dmg'))
check('button says Mac', mac.label, (l) => /Mac/i.test(l))
check('shows the macOS install steps', mac.macSteps, true)
check('hides the Windows install steps', mac.winSteps, false)
check('offers a way to the Windows build', mac.alts.join(' | '), (a) => /Windows/i.test(a))

const phone = await visit(UA.iphone)
console.log('\niPhone:')
check('does not offer a desktop installer', phone.href, (h) => !/\.(dmg|exe)$/.test(h))
check('says it is a desktop app', phone.meta, (m) => /desktop/i.test(m))

const other = await visit(UA.linux)
console.log('\nUnrecognised system:')
check('hands out no file by default', other.href, (h) => !/\.(dmg|exe)$/.test(h))
check('asks which system', other.meta, (m) => /choose your system/i.test(m))
check('offers both', other.alts.join(' | '), (a) => /Mac/i.test(a) && /Windows/i.test(a))
check('shows both sets of steps', other.macSteps && other.winSteps, true)

await browser.close()
if (server) server.close()

console.log(failures.length ? `\n${failures.length} FAILED\n` : '\nall good\n')
process.exit(failures.length ? 1 : 0)
