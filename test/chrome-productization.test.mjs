import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = async path => readFile(new URL('../' + path, import.meta.url), 'utf8')
const home = await read('dist/index.html')
const chrome = await read('dist/chrome/index.html')
const config = await read('dist/chrome/config.js')
const script = await read('dist/chrome/chrome.js')

test('Orbit public site has Chrome-first entry while Desktop download remains available', () => {
  assert.ok(home.includes('href="/chrome/"'))
  assert.ok(home.includes('Start with Chrome'))
  assert.match(home, /id="dl-btn" data-orbit-download/)
  assert.ok(chrome.includes('Orbit for Chrome'))
  assert.ok(chrome.includes('Cloud Agent runs on Orbit servers'))
  assert.ok(chrome.includes('Chrome shows a browser-control'))
})

test('Store install link is disabled until owner configures an actual listing', () => {
  assert.ok(config.includes("storeUrl: ''"))
  assert.ok(config.includes("storeExtensionId: ''"))
  assert.match(chrome, /id="store-link"[^>]+hidden/)
  assert.ok(script.includes('chromewebstore.google.com'))
  assert.doesNotMatch(config, /clientSecret|QWEN_API_KEY|RELAY_ADMIN_TOKEN/)
})

test('Website can only detect an explicitly allowed Extension ID, never pair via public website', () => {
  assert.ok(script.includes("type:'orbit-installed-ping'"))
  assert.ok(script.includes('/^[a-p]{32}$/'))
  assert.doesNotMatch(script, /orbit-connect|orbit-local-stop|orbit-authorize-site/)
  assert.ok(script.includes('extensionId'))
  assert.doesNotMatch(chrome, /<input[^>]+type="password"/)
})
