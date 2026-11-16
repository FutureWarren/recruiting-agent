/** Verify real headless Chromium fake camera on phone widths. No real photos/API. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
process.env.SITE_TEST_ROOT='dist'
const {serve}=await import('./static-server.mjs')
const server=await serve()
const browser=await chromium.launch({
  headless:true,
  args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']
})
try{
  for(const [name,width,height] of [['iphone-size',390,844],['small-phone',320,568]]){
    const context=await browser.newContext({
      viewport:{width,height},reducedMotion:'reduce',permissions:['camera']
    })
    const errors=[],uploads=[]
    await context.route('**/*',route=>{
      const req=route.request(),url=new URL(req.url())
      if(url.origin===server.base)return route.continue()
      if(url.pathname==='/api/face-match/config')
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true,dailyLimit:500})})
      if(url.pathname==='/api/public-tools/view'||url.pathname==='/api/handoff/event'||url.pathname==='/api/public-tools/event')
        return route.fulfill({status:204,body:''})
      if(url.pathname==='/api/face-match/analyze'){uploads.push(req.postDataJSON());return route.abort()}
      return route.abort() // no external MediaPipe or provider calls
    })
    const page=await context.newPage()
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto(server.base+'/face-match/')
    await page.locator('#open-camera').click()
    await page.locator('#camera-modal:not([hidden])').waitFor()
    await page.waitForFunction(()=>document.getElementById('camera').videoWidth>0)
    await page.locator('#snap:enabled').waitFor()
    assert.equal(await page.evaluate(()=>document.body.classList.contains('fm-camera-open')),true)
    assert.equal(await page.locator('#camera').evaluate(node=>getComputedStyle(node).transform.startsWith('matrix(-1')),true,
      name+' front preview mirrors like an iPhone selfie')
    let box=await page.locator('#snap').boundingBox()
    assert.ok(box&&box.width>=70&&box.height>=70,name+' shutter target must be large')
    assert.ok(box.y>=0&&box.y+box.height<=height+2,name+' shutter stays visible without scrolling')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,name+' horizontal overflow')
    assert.equal(await page.locator('#cancel-camera').isVisible(),true)

    await page.locator('#flip-camera').click()
    await page.waitForFunction(()=>document.getElementById('camera').videoWidth>0 &&
      !document.getElementById('flip-camera').disabled &&
      !document.getElementById('camera').classList.contains('is-mirrored'))
    assert.equal(await page.locator('#camera-facing-label').innerText(),'Rear camera')
    await page.locator('#flip-camera').click()
    await page.waitForFunction(()=>document.getElementById('camera').videoWidth>0 &&
      !document.getElementById('flip-camera').disabled &&
      document.getElementById('camera').classList.contains('is-mirrored'))

    await page.locator('#snap').click()
    await page.locator('#camera-review-actions:not([hidden])').waitFor()
    await page.locator('#camera-captured-preview').waitFor({state:'visible'})
    await page.waitForFunction(()=>document.getElementById('camera-captured-preview').naturalWidth>0)
    assert.equal(await page.locator('#camera-controls').isVisible(),false)
    assert.equal(await page.locator('#camera-captured-preview').evaluate(node=>node.naturalWidth>300),true)

    await page.locator('#retake-photo').click()
    await page.waitForFunction(()=>document.getElementById('camera').videoWidth>0)
    await page.locator('#snap:enabled').click()
    await page.locator('#camera-review-actions:not([hidden])').waitFor()
    await page.locator('#use-photo').click()
    await page.locator('#camera-modal[hidden]').waitFor({state:'attached'})
    assert.equal(await page.locator('#photo-preview').isVisible(),true,name+' photo preview accepted')
    assert.equal(await page.locator('#consent').isChecked(),false,name+' photo capture does not imply analysis consent')
    assert.equal(uploads.length,0,name+' no AI upload before user explicitly consents')
    assert.equal(await page.evaluate(()=>document.body.classList.contains('fm-camera-open')),false)

    await page.locator('#open-camera').click()
    await page.locator('#camera-modal:not([hidden])').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('#camera-modal[hidden]').waitFor({state:'attached'})
    assert.equal(await page.evaluate(()=>document.body.classList.contains('fm-camera-open')),false)
    assert.deepEqual(errors,[],name+' uncaught browser exceptions')
    await context.close()
  }
  console.log('PASS Face Match camera: front mirror parity, fixed shutter, rear switch, review/retake, consent and mobile scroll lock')
}finally{await browser.close();await server.close()}
