/**
 * Network CTA from the playful Face Match result is deliberately self-selected:
 * no employment claim from the photo, no automatic email, no hidden subscription.
 */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
process.env.SITE_TEST_ROOT = 'dist'
const { serve } = await import('./static-server.mjs')
const server = await serve()
const browser = await chromium.launch({headless:true})
const result = {
  title:'Wall Street Classic',tagline:'A tailored, understated style impression.',
  explanation:'This looks like a polished photo style. It is not a hiring or career assessment.',
  tags:['Tailored','Minimal'],
  matches:[
    {id:'wall-street',score:82},{id:'consulting',score:75},
    {id:'tech',score:64},{id:'founder',score:61},{id:'client-facing',score:55}
  ]
}
try {
  const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  const sent=[],events=[],errors=[]
  await context.route('**/*',route=>{
    const req=route.request(),u=new URL(req.url())
    if(u.origin===server.base)return route.continue()
    if(u.pathname==='/api/face-match/config')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true})})
    if(u.pathname==='/api/public-tools/view'||u.pathname==='/api/handoff/event')return route.fulfill({status:204,body:''})
    if(u.pathname==='/api/public-tools/event'){
      events.push(req.postDataJSON())
      return route.fulfill({status:204,body:''})
    }
    if(u.pathname==='/api/handoff/start'){
      sent.push(req.postDataJSON())
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({emailStatus:'accepted',continueUrl:server.base+'/continue/?token=fixture'})})
    }
    return route.abort()
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(server.base+'/face-match/')
  await page.evaluate(data=>{
    window.render(data)
    window.show('results')
  },result)
  await page.locator('#fm-network-bridge').scrollIntoViewIfNeeded()
  assert.match(await page.locator('#fm-network-title').innerText(),/Connections open doors/)
  assert.equal(await page.locator('.fm-industry-choices button[aria-pressed="true"]').count(),0)
  await page.locator('[data-networking-interest="Technology"]').click()
  assert.equal(await page.locator('[data-networking-interest="Technology"]').getAttribute('aria-pressed'),'true')
  assert.match(await page.locator('#fm-networking-cta').innerText(),/Tech|networking/i)
  assert.equal(sent.length,0)
  await page.locator('#fm-networking-cta').click()
  await page.waitForURL(/\/start\/\?/)
  assert.equal(new URL(page.url()).searchParams.get('source'),'face_match')
  assert.match(await page.locator('#networking-prep-goal').innerText(),/Technology/)
  assert.equal(await page.locator('#email').inputValue(),'')
  assert.equal(sent.length,0,'no email sent from photo tool or landing')
  await page.locator('#email').fill('student@example.test')
  await page.locator('#submit').click()
  await page.locator('#success:not([hidden])').waitFor()
  assert.equal(sent.length,1)
  assert.equal(sent[0].source,'face_match')
  assert.match(sent[0].goal,/Technology/)
  assert.doesNotMatch(sent[0].goal,/Wall Street|aura|attractiveness/i)
  assert.equal(sent[0].email,'student@example.test')
  for(let tries=0;tries<20&&!events.some(e=>e.event==='networking_cta_clicked');tries++)await new Promise(resolve=>setTimeout(resolve,50))
  assert.ok(events.some(e=>e.event==='networking_cta_clicked'))
  assert.ok(events.every(e=>!('photo' in e)&&!('industry' in e)&&!('email' in e)&&!('goal' in e)))
  assert.deepEqual(errors,[])
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await context.close()
  console.log('PASS Face Match: independently chosen interest -> prepared Orbit handoff, no inferred career qualification')
}finally{
  await browser.close()
  await server.close()
}
