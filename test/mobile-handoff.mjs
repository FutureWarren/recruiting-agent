import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8')
const js=readFileSync(new URL('../home.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../home.css',import.meta.url),'utf8')
const cont=readFileSync(new URL('../continue/continue.js',import.meta.url),'utf8')
const contHtml=readFileSync(new URL('../continue/index.html',import.meta.url),'utf8')

assert.match(html,/id="mobile-handoff"/)
assert.match(html,/id="handoff-email"/)
assert.match(html,/name="handoff-goal"/)
assert.doesNotMatch(html,/mobile-handoff[\s\S]{0,5000}type="file"/)
assert.match(js,/backend-production-2b40\.up\.railway\.app/)
assert.match(js,/stage:'mobile_landing'/)
assert.match(js,/stage:'form_started'/)
assert.match(js,/\/api\/handoff\/start/)
assert.match(js,/source/)
assert.match(css,/Mobile handoff capture/)
assert.match(contHtml,/id="open-orbit"/)
assert.match(cont,/orbit:\/\/handoff\?token=/)
assert.match(cont,/stage:'desktop_link_opened'/)
assert.match(cont,/stage:'download_clicked'/)
assert.doesNotMatch(cont,/stage:'desktop_app_opened'/)

execFileSync(process.execPath,['--check',new URL('../home.js',import.meta.url).pathname],{stdio:'inherit'})
execFileSync(process.execPath,['--check',new URL('../continue/continue.js',import.meta.url).pathname],{stdio:'inherit'})
console.log('mobile handoff contracts: ok')
