import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('optional newsletter requires explicit, unchecked opt-in',()=>{
  const page=read('index.html')
  assert.match(page, /id="orbit-radar-consent"[^>]*required/)
  assert.match(page, /id="mobile-news-consent"/)
  assert.doesNotMatch(page,/id="orbit-radar-consent"[^>]*checked/)
  assert.doesNotMatch(page,/id="mobile-news-consent"[^>]*checked/)
  assert.match(page,/id="orbit-radar-frequency"/)
  assert.match(page,/newsletter\.js/)
  assert.match(page,/newsletter\.css/)
})
test('newsletter sends double-opt-in request, not marketing sends',()=>{
 const js=read('newsletter.js')
 assert.match(js,/\/api\/marketing\/subscribe/)
 assert.match(js,/consent:true/)
 assert.match(js,/Check your inbox and confirm/)
 assert.doesNotMatch(js,/\/api\/marketing\/send/)
})
test('mobile website link works without newsletter consent',()=>{
 const js=read('home.js')
 assert.match(js,/newsConsent\?\.checked/)
 assert.match(js,/\/api\/handoff\/start/)
 assert.match(js,/Recruiting Radar signup could not be completed/)
})
