/** Opt-in prompt acceptance with mocked Orbit API; never contacts real email provider. */
import assert from 'node:assert/strict'
import {chromium,webkit} from 'playwright'
process.env.SITE_TEST_ROOT='dist'
const {serve}=await import('./static-server.mjs')
const server=await serve()
const fixture={
  title:'Mixed Career Aura',tagline:'Calm Energy · Focused Look',
  explanation:'A playful photo style. Not a career qualification.',
  tags:['Calm Energy','Focused Look','Gentle Charm'],
  matches:[
    {id:'consulting',score:68},{id:'wall-street',score:66},
    {id:'tech',score:63},{id:'founder',score:51},{id:'client-facing',score:48}
  ]
}
async function run(engine,browserType){
  const browser=await browserType.launch({headless:true})
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
    const sent=[],errors=[],events=[]
    let status=200,provider='accepted'
    await context.route('**/*',route=>{
      const req=route.request(),url=new URL(req.url())
      if(url.origin===server.base)return route.continue()
      if(url.pathname==='/api/face-match/config')
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true})})
      if(['/api/public-tools/view','/api/public-tools/event','/api/handoff/event'].includes(url.pathname)){
        events.push({path:url.pathname,body:req.postData()})
        return route.fulfill({status:204,body:''})
      }
      if(url.pathname==='/api/handoff/start'){
        sent.push(req.postDataJSON())
        return route.fulfill({
          status,contentType:'application/json',
          body:JSON.stringify(status===200?{
            continueUrl:'https://orbit-reaches.com/continue/?token=fixture',
            emailStatus:provider
          }:{error:'Too many handoff emails requested. Try again shortly.'})
        })
      }
      return route.abort()
    })
    const page=await context.newPage()
    page.on('pageerror',e=>errors.push(e.message))
    await page.clock.install()
    await page.goto(server.base+'/face-match/')
    await page.evaluate(data=>{window.render(data);window.show('results')},fixture)
    assert.equal(await page.locator('#fm-email-nudge').isVisible(),false,engine+' not immediate')
    await page.clock.fastForward(9999)
    assert.equal(await page.locator('#fm-email-nudge').isVisible(),false,engine+' not before ten seconds')
    await page.clock.fastForward(1)
    await page.locator('#fm-email-nudge:not([hidden])').waitFor()
    assert.equal(sent.length,0,'no email request on mere impression')
    assert.equal(await page.locator('#fm-email-nudge-input').isVisible(),true)
    assert.equal(await page.locator('#fm-email-nudge-submit').isVisible(),true)
    assert.equal(await page.locator('#fm-email-nudge-input').evaluate(el=>getComputedStyle(el).fontSize),'16px',
      'iPhone must not zoom on focus')
    const bounds=await page.locator('#fm-email-nudge').boundingBox()
    assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=846,'nudge fits mobile viewport')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,
      'no horizontal overflow')
    assert.equal(await page.locator('#fm-email-nudge-input').evaluate(el=>document.activeElement===el),false,
      'show should not steal focus from report')
    assert.equal(await page.locator('#share').isVisible(),true,'share remains available')

    await page.locator('#fm-email-nudge-input').fill('student@example.test')
    await page.locator('#fm-email-nudge-submit').click()
    await page.locator('#fm-email-nudge-success:not([hidden])').waitFor()
    assert.equal(sent.length,1,'one explicit opt-in email request')
    const payload=sent[0]
    assert.equal(payload.source,'face_match')
    assert.equal(payload.email,'student@example.test')
    assert.equal(payload.utm_campaign,'post_result_email')
    assert.equal(payload.funnelVersion,2)
    assert.ok(payload.visitorId)
    assert.match(payload.goal,/Find relevant alumni/)
    assert.match(payload.detail,/Never send messages without my approval/)
    assert.ok(!Object.keys(payload).some(k=>/image|photo|aura|score|company|ethnicity/i.test(k)),
      'do not send photo or inferred results to handoff')
    assert.match(await page.locator('#fm-email-nudge-success-copy').innerText(),/accepted|link|computer/i)
    assert.equal(await page.locator('#fm-email-nudge-link').getAttribute('href'),
      'https://orbit-reaches.com/continue/?token=fixture')
    assert.doesNotMatch(await page.locator('#fm-email-nudge-success').innerText(),/registered|job offer/i)
    await page.locator('#fm-email-nudge-done').click()
    assert.equal(await page.locator('#fm-email-nudge').isVisible(),false)
    await page.evaluate(data=>{window.show('capture');window.render(data);window.show('results')},fixture)
    await page.clock.fastForward(18_000)
    assert.equal(await page.locator('#fm-email-nudge').isVisible(),false,
      'do not reprompt after successful opt-in')

    const another=await context.newPage()
    await another.clock.install()
    await another.goto(server.base+'/face-match/')
    await another.evaluate(data=>{window.render(data);window.show('results')},fixture)
    await another.clock.fastForward(10_000)
    await another.locator('#fm-email-nudge:not([hidden])').waitFor()
    await another.locator('#fm-email-nudge-later').click()
    await another.evaluate(data=>{window.show('capture');window.render(data);window.show('results')},fixture)
    await another.clock.fastForward(15_000)
    assert.equal(await another.locator('#fm-email-nudge').isVisible(),false,
      'dismissed once per tab session')
    assert.equal(sent.length,1,'dismissal never sends an email')
    await another.close()

    const retry=await context.newPage()
    await retry.clock.install()
    status=429
    await retry.goto(server.base+'/face-match/')
    await retry.evaluate(data=>{window.render(data);window.show('results')},fixture)
    await retry.clock.fastForward(10_000)
    await retry.locator('#fm-email-nudge:not([hidden])').waitFor()
    await retry.locator('#fm-email-nudge-input').fill('retry@example.test')
    await retry.locator('#fm-email-nudge-submit').click()
    await retry.locator('#fm-email-nudge-error:not([hidden])').waitFor()
    assert.match(await retry.locator('#fm-email-nudge-error').innerText(),/too many|shortly/i)
    assert.equal(await retry.locator('#fm-email-nudge-success').isVisible(),false)
    status=200
    provider='failed'
    await retry.locator('#fm-email-nudge-submit').click()
    await retry.locator('#fm-email-nudge-success:not([hidden])').waitFor()
    assert.match(await retry.locator('#fm-email-nudge-success-copy').innerText(),/not confirmed/i)
    await retry.close()

    assert.deepEqual(errors,[],engine+' must not throw')
    assert.ok(events.every(e=>!e.body||!e.body.includes('student@example.test')),
      'anonymous analytics must not include email')
    await context.close()
    console.log('PASS '+engine+': 10s delay, no auto-email, mobile opt-in, provider states, dismissal and privacy')
  }finally{await browser.close()}
}
try{
  await run('Chromium',chromium)
  await run('WebKit',webkit)
}finally{await server.close()}
