/** Real mobile and desktop handoff E2E. External services mocked; no emails sent. */
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
process.env.SITE_TEST_ROOT='dist'
const {serve}=await import('./static-server.mjs')
const server=await serve()
const browser=await chromium.launch({headless:true})
const tablet=async(width,height,kind)=>{
  const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'})
  const requests=[],errors=[]
  await ctx.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url())
    if(url.origin===server.base)return route.continue()
    if(url.pathname==='/api/handoff/event'||url.pathname==='/api/public-tools/view'||url.pathname==='/api/public-tools/event')
      return route.fulfill({status:204,body:''})
    if(url.pathname==='/api/handoff/start'){
      requests.push(req.postDataJSON())
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        emailStatus:'accepted',continueUrl:server.base+'/continue/?token=test-only-token'
      })})
    }
    return route.abort()
  })
  const page=await ctx.newPage()
  page.on('pageerror',err=>errors.push(err.message))
  await page.goto(server.base+'/start/')
  await page.evaluate(intent=>window.OrbitNetworkingBridge.prepare(intent),
    kind==='face'?{source:'face_match',industry:'Technology'}:
    {source:'resume_evaluation',company:'Morgan Stanley',email:'student@example.test'})
  const source=kind==='face'?'face_match':'resume_evaluation'
  await page.goto(server.base+'/start/?source='+source+'&utm_campaign=networking_activation')
  await page.locator('.is-networking').waitFor()
  assert.equal(await page.locator('#start-heading').innerText(),'Start networking.')
  const goal=await page.locator('#networking-prep-goal').innerText()
  assert.equal(goal,kind==='face'?'Find alumni in Technology':'Find alumni at Morgan Stanley')
  assert.equal(await page.locator('#networking-prep').isVisible(),true)
  assert.equal(await page.locator('.intro .handoff-line').count(),0,'do not render decorative stepper')
  assert.equal(await page.locator('.intro .promise').count(),0,'no stacked instructional list')
  assert.equal(await page.locator('#email').isVisible(),true)
  assert.equal(await page.locator('#submit').isVisible(),true)
  assert.equal(await page.locator('#start-back').getAttribute('href'),kind==='face'?'/face-match/':'/resume-score/')
  const metrics=await page.evaluate(()=>{
    function rgb(color){const parts=color.match(/[\d.]+/g);return parts?.slice(0,3).map(Number)||[0,0,0]}
    const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)})
      .reduce((a,b,i)=>a+b*[.2126,.7152,.0722][i],0)
    const contrast=(a,b)=>{const x=lum(rgb(a)),y=lum(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
    const read=(selector,parentSelector)=>{const el=document.querySelector(selector),bg=document.querySelector(parentSelector||selector);return contrast(getComputedStyle(el).color,getComputedStyle(bg).backgroundColor)}
    const input=document.querySelector('#email').getBoundingClientRect()
    const submit=document.querySelector('#submit').getBoundingClientRect()
    return {
      task:read('#networking-prep-goal','#networking-prep'),
      taskNote:read('#networking-prep p','#networking-prep'),
      input:read('#email'),
      submit:read('#submit'),
      inputY:input.y,buttonBottom:submit.bottom,
      overflow:document.documentElement.scrollWidth>innerWidth,
      fontSize:parseFloat(getComputedStyle(document.querySelector('#email')).fontSize)
    }
  })
  assert.ok(metrics.task>=7,'task heading contrast '+metrics.task)
  assert.ok(metrics.taskNote>=4.5,'task description contrast '+metrics.taskNote)
  assert.ok(metrics.input>=7,'email input text contrast '+metrics.input)
  assert.ok(metrics.submit>=7,'CTA contrast '+metrics.submit)
  assert.equal(metrics.overflow,false,'no mobile horizontal overflow')
  assert.equal(metrics.fontSize,16,'prevent iOS input-focus zoom')
  if(width>=390&&height>=800){
    assert.ok(metrics.inputY>0&&metrics.inputY<height-150,'email appears in first phone viewport')
    assert.ok(metrics.buttonBottom<=height-8,'CTA fits above the first fold: '+JSON.stringify(metrics))
  }
  if(kind==='face'&&width>=390){
    await mkdir('artifacts',{recursive:true})
    await page.screenshot({path:'artifacts/start-networking-mobile.png',fullPage:true})
  }
  if(kind==='face')await page.locator('#email').fill('student@example.test')
  assert.equal(await page.locator('#email').inputValue(),'student@example.test')
  await page.locator('#submit').click()
  await page.locator('#success:not([hidden])').waitFor()
  assert.equal(requests.length,1,'send only after explicit submit')
  assert.equal(requests[0].source,source)
  assert.equal(requests[0].email,'student@example.test')
  assert.match(requests[0].goal,kind==='face'?/Technology/:/Morgan Stanley/)
  assert.match(requests[0].detail,/Never send messages without my approval/)
  assert.ok(requests[0].visitorId,'preserve visitor attribution')
  assert.deepEqual(errors,[])
  await ctx.close()
}
try{
  await tablet(390,844,'face')
  await tablet(390,844,'resume')
  await tablet(360,740,'face')
  await tablet(320,568,'face')
  const ctx=await browser.newContext({viewport:{width:1280,height:900}})
  await ctx.route('**/*',route=>{
    const url=new URL(route.request().url())
    if(url.origin===server.base)return route.continue()
    return route.fulfill({status:204,body:''})
  })
  const page=await ctx.newPage()
  await page.goto(server.base+'/start/')
  assert.equal(await page.locator('#networking-prep').isVisible(),false,'direct visitors should not see a fictional task')
  assert.equal(await page.locator('#email').isVisible(),true)
  assert.equal(await page.locator('#start-heading').innerText(),'Get Orbit on your computer.')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await ctx.close()
  console.log('PASS Orbit /start/ networking: first-fold CTA, accessible contrast, real email handoff for both tools, no fake task on direct visits')
}finally{await browser.close();await server.close()}
