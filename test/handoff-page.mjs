import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { serve } from './static-server.mjs'
const server=await serve(),browser=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']})
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'})
 // The public page embeds a third-party player. This test verifies our own UI
 // and API contracts offline, so never wait on Descript network navigation.
 await ctx.route('https://share.descript.com/**',route=>route.fulfill({
  status:200,contentType:'text/html',body:'<!doctype html><html><body>Orbit demo fixture</body></html>'
 }))
 const page=await ctx.newPage(),requests=[]
 await ctx.route('https://backend-production-2b40.up.railway.app/api/handoff/**',async route=>{
  const req=route.request();requests.push({url:req.url(),method:req.method(),body:req.postData()})
  if(req.url().endsWith('/start'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({continueUrl:server.base+'/continue/?token=abcdefghijklmnopqrstuvwx.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',emailStatus:'delivered'})})
  if(req.url().endsWith('/resolve'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({firstName:'',goal:'',detail:''})})
  return route.fulfill({status:204,body:''})
 })
 await page.goto(server.base+'/?source=nyu_library&utm_campaign=launch',{waitUntil:'domcontentloaded'})
 await page.waitForSelector('#mobile-handoff-modal.is-open')
 assert.equal(await page.locator('#mobile-handoff-email').isVisible(),true,'mobile visitors see email sheet immediately')
 assert.equal(await page.evaluate(()=>document.activeElement?.id==='mobile-handoff-email'),false,'no automatic keyboard')
 assert.equal(requests.some(r=>['cta_clicked_v2','email_started_v2'].includes(JSON.parse(r.body||'{}').stage)),false,'display is not a click or email start')
 await page.locator('.mobile-handoff-close').click()
 await page.locator('#mobile-handoff-modal').waitFor({state:'hidden'})
 await page.locator('#orbit-task-school').waitFor({state:'visible'})
 assert.equal(await page.locator('#hero-demo').evaluate(el=>!!el.closest('.hero-copy')),true)
 await page.fill('#orbit-task-school','NYU')
 await page.locator('#orbit-task-industry').selectOption('Investment Banking')
 await page.click('.orbit-task-submit')
 await page.waitForSelector('#mobile-handoff-modal.is-open')
 assert.equal(await page.locator('#mobile-handoff-form input').count(),1,'save still only requests email')
 assert.equal(await page.locator('#mobile-handoff-email').isVisible(),true)
 assert.equal(await page.locator('input[type=file]').count(),0,'website must not ask for a resume')
 assert.match(await page.locator('#mobile-prepared-task').textContent(),/NYU alumni in Investment Banking/)
 await page.fill('#mobile-handoff-email','student@example.com')
 await page.click('#mobile-handoff-submit')
 await page.waitForSelector('#mobile-handoff-success:not([hidden])')
 assert.match(await page.locator('#mobile-handoff-success-title').textContent(),/Check your inbox/)
 assert.equal(await page.locator('#mobile-handoff-copy').isVisible(),true,'keep copy-link fallback visible even after delivery')
 assert.equal(await page.locator('#mobile-handoff-modal.is-open').isVisible(),true,'do not dismiss next steps automatically')
 const start=requests.find(r=>r.url.endsWith('/start'))
 assert.ok(start,'handoff start request missing')
 const body=JSON.parse(start.body)
 assert.equal(body.funnelVersion,2);assert.equal(body.platform,'mobile');assert.equal(body.firstName,undefined);assert.equal(body.email,'student@example.com');assert.match(body.goal,/NYU alumni in Investment Banking/);assert.match(body.detail,/personalized networking email drafts/);assert.equal(body.source,'nyu_library');assert.equal(body.utm_campaign,'launch')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 const fallback=await ctx.newPage()
 await fallback.goto(server.base+'/start/?source=nyu_library')
 assert.equal(await fallback.locator('#first-name').count(),0)
 assert.equal(await fallback.locator('#email').isVisible(),true)
 assert.equal(await fallback.locator('#goal-grid button').count(),0)
 await fallback.fill('#email','fallback@example.com')
 await fallback.click('#submit')
 await fallback.waitForSelector('#success:not([hidden])')
 assert.equal(JSON.parse(requests.filter(r=>r.url.endsWith('/start')).at(-1).body).firstName,undefined)
 await fallback.close()
 await ctx.addInitScript(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async({url})=>{window.__orbitSharedUrl=url}}))
 const phoneContinue=await ctx.newPage()
 const mobileUrl=server.base+'/continue/?token=abcdefghijklmnopqrstuvwx.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ'
 await phoneContinue.goto(mobileUrl)
 await phoneContinue.waitForSelector('#actions:not([hidden])')
 assert.equal(await phoneContinue.locator('#title').textContent(),'Welcome to Orbit.')
 assert.equal(await phoneContinue.locator('#open-app').isHidden(),true)
 assert.equal(await phoneContinue.locator('#download').getAttribute('href'),'#','phone link must be keyboard-focusable and must not restart the signup')
 await phoneContinue.locator('#download').click()
 assert.equal(await phoneContinue.evaluate(()=>window.__orbitSharedUrl),mobileUrl)
 assert.equal(requests.some(r=>r.url.endsWith('/event')&&JSON.parse(r.body||'{}').stage==='download_clicked'),false,'sharing on phone is not an installer download')
 await phoneContinue.close()
 await ctx.close()
 const desktop=await browser.newContext({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0'})
 await desktop.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{platform:'macOS',getHighEntropyValues:async()=>({architecture:'arm'})}}))
 const platformReleases=[
  {tag_name:'v0.1.121',assets:[{name:'Orbit-0.1.121-arm64.dmg',browser_download_url:'https://example.test/orbit.dmg'}]},
  {tag_name:'v0.1.120',assets:[{name:'Orbit-0.1.120-x64-Setup.exe',browser_download_url:'https://example.test/orbit.exe'}]}
 ]
 const p=await desktop.newPage()
 await p.route('https://backend-production-2b40.up.railway.app/api/handoff/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({firstName:'Future',goal:'',detail:''})}))
 await p.route('https://api.github.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(platformReleases)}))
 await p.goto(server.base+'/continue/?token=abcdefghijklmnopqrstuvwx.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ')
 await p.waitForSelector('#actions:not([hidden])')
 assert.equal(await p.locator('#title').textContent(),'Welcome, Future.')
 assert.equal(await p.locator('#receipt').isHidden(),true)
 const resolveReq=requests.find(r=>r.url.endsWith('/resolve'))
 // Desktop context uses its own request list below in browser routing; the
 // product contract is body-token resolve rather than a credential in URL.
 await p.waitForSelector('#download[href="https://example.test/orbit.dmg"]')
 assert.match(await p.locator('#open-app').getAttribute('href'),/^orbit:\/\/handoff\?token=/)
 await desktop.close()

 const windows=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0'})
 await windows.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{platform:'Windows',getHighEntropyValues:async()=>({architecture:'x86'})}}))
 const w=await windows.newPage()
 await w.route('https://backend-production-2b40.up.railway.app/api/handoff/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({firstName:'Future',goal:'',detail:''})}))
 await w.route('https://api.github.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(platformReleases)}))
 await w.goto(server.base+'/continue/?token=abcdefghijklmnopqrstuvwx.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ')
 await w.waitForSelector('#actions:not([hidden])')
 await w.waitForSelector('#download[href="https://example.test/orbit.exe"]')
 assert.match(await w.locator('#download').textContent(),/Windows/)
 assert.match(await w.locator('#status').textContent(),/unsigned.*SmartScreen.*Unknown Publisher/i)
 assert.match(await w.locator('#open-app').getAttribute('href'),/^orbit:\/\/handoff\?token=/)
 await windows.close()

 const supportedHostsOnly = async page => {
  await page.route('https://backend-production-2b40.up.railway.app/api/handoff/**', route => route.fulfill({
    status:200, contentType:'application/json', body:JSON.stringify({firstName:'Student',goal:'Research alumni'})
  }))
 }
 for (const [platform,arch] of [['macOS','x86'],['Windows','arm']]) {
  const page = await browser.newPage()
  await page.addInitScript(({platform,arch}) => Object.defineProperty(navigator,'userAgentData',{value:{
    platform,getHighEntropyValues:async()=>({architecture:arch})
  }}),{platform,arch})
  await supportedHostsOnly(page)
  let installerRequests=0
  await page.route('https://api.github.com/**', route => { installerRequests++; return route.abort() })
  await page.goto(mobileUrl)
  await page.waitForSelector('#download:has-text("Copy / share desktop link")')
  assert.match(await page.locator('#status').textContent(),/supported computer/)
  assert.equal(await page.locator('#open-app').isHidden(),true)
  assert.equal(installerRequests,0,platform+' must not query or offer an incompatible installer')
  await page.close()
 }

 const stalled = await browser.newPage()
 await stalled.addInitScript(() => {
  Object.defineProperty(navigator,'userAgentData',{value:{platform:'Windows',getHighEntropyValues:async()=>({architecture:'x86'})}})
  const fetchReal = window.fetch
  window.fetch = (url,options) => {
   if(!String(url).startsWith('https://api.github.com/')) return fetchReal(url,options)
   return new Promise((_,reject) => options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}))
  }
 })
 await supportedHostsOnly(stalled)
 await stalled.goto(mobileUrl)
 await stalled.waitForSelector('#download[href="https://github.com/FutureWarren/recruiting-agent/releases"]',{timeout:8000})
 assert.match(await stalled.locator('#download').textContent(),/View Windows downloads/)
 assert.equal(await stalled.locator('#open-app').isVisible(),true)
 await stalled.close()

 console.log('PASS handoff: email-first capture, optional personalized task, portable signed link, platform-safe installers, bounded installer lookup and deep-link CTA.')
}finally{await browser.close();await server.close()}