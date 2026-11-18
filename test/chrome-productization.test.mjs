import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = async path => readFile(new URL('../' + path, import.meta.url), 'utf8')
const home = await read('dist/index.html')
const chrome = await read('dist/chrome/index.html')
const config = await read('dist/chrome/config.js')
const script = await read('dist/chrome/chrome.js')

test('Orbit public site has Chrome-first entry while Desktop download remains available', () => {
  assert.match(home, /href="\\/chrome\\/"/)
  assert.match(home, /Start with Chrome/)
  assert.match(home, /id="dl-btn" data-orbit-download/)
  assert.match(chrome, /Orbit for Chrome/)
  assert.match(chrome, /Cloud Agent runs on Orbit servers/)
  assert.match(chrome, /Chrome shows a browser-control \\/ debugging banner/)
})

test('Store install link is disabled until owner configures an actual listing', () => {
  assert.match(config, /storeUrl: ''/)
  assert.match(config, /storeExtensionId: ''/)
  assert.match(chrome, /id="store-link"[^>]+hidden/)
  assert.match(script, /chromewebstore\\.google\\.com/)
  assert.doesNotMatch(config, /clientSecret|QWEN_API_KEY|RELAY_ADMIN_TOKEN/)
})

test('Website can only detect an explicitly allowed Extension ID, never pair via public website', () => {
  assert.match(script, /type:'orbit-installed-ping'/)
  assert.match(script, /\\^\\[a-p\\]\\{32\\}\\$/)
  assert.doesNotMatch(script, /orbit-connect|orbit-local-stop|orbit-authorize-site/)
  assert.match(script, /extensionId/)
  assert.doesNotMatch(chrome, /<input[^>]+type="password"/)
})
