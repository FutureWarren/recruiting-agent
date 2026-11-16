/** Real Chromium UI, mocked backend; no user photo, account data or model calls. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
process.env.SITE_TEST_ROOT='dist'
const {serve}=await import('./static-server.mjs')
const server=await serve()
const browser=await chromium.launch({headless:true})
async function ensurePhotoReady(page){
  try{await page.locator('#photo-preview:not([hidden])').waitFor({timeout:9000})}
  catch(err){
    const state=await page.evaluate(()=>({
      hasPhoto:typeof photo!=='undefined'&&Boolean(photo),
      ready:typeof serverReady!=='undefined'&&serverReady,
      error:document.getElementById('error')?.textContent,
      errorHidden:document.getElementById('error')?.hidden,
      previewHidden:document.getElementById('photo-preview')?.hidden,
      cameraModal:document.getElementById('camera-modal')?.hidden,
      analyzeDisabled:document.getElementById('analyze')?.disabled
    }))
    throw Error('Synthetic photo upload did not complete: '+JSON.stringify(state)+'; '+err.message)
  }
}
const moods=['sweet','bold','bright','cool','playful','composed','friendly','expressive']
const mixed={
 version:'photo-vibe-v2',methodology:'independent-photo-cues-v3',mixed:true,
 title:'Mixed Career Aura',subtitle:'No Forced Match',
 tagline:'Calm Presence · Focused Look',
 explanation:'This portrait presents balanced, ambiguous visual cues.',
 tags:['Calm Presence','Focused Look','Balanced Vibes'],
 matches:[{id:'consulting',score:69},{id:'wall-street',score:65},
   {id:'client-facing',score:63},{id:'tech',score:61},{id:'founder',score:48}],
 company:null,companyAlternates:[],
 vibeBreakdown:moods.map((id,i)=>({id,label:id,value:[2,1,2,2,0,3,2,1][i]}))
}
const company={name:'Goldman Sachs',domain:'goldmansachs.com',mood:'Boardroom-inspired',category:'wall-street'}
const finance={...mixed,mixed:false,title:'Wall Street Energy',subtitle:'The Boardroom Icon',
 company,companyAlternates:[
  {name:'J.P. Morgan',domain:'jpmorgan.com',mood:'Classic',category:'wall-street'},
  {name:'Morgan Stanley',domain:'morganstanley.com',mood:'Refined',category:'wall-street'}
 ]}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 let scenario='mixed'
 const seen=[],errors=[]
 await context.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url())
   if(u.origin===server.base)return route.continue()
   if(u.pathname==='/api/face-match/config')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true})})
   if(u.pathname==='/api/face-match/analyze'){
     seen.push(req.postDataJSON())
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(scenario==='mixed'?mixed:finance)})
   }
   if(u.pathname==='/api/public-tools/view'||u.pathname==='/api/handoff/event'||u.pathname==='/api/public-tools/event')return route.fulfill({status:204,body:''})
   return route.abort()
 })
 const page=await context.newPage()
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(server.base+'/face-match/')
 // Generate a synthetic, non-personal JPEG entirely in browser memory.
 const jpeg=await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=480;c.height=640
   const x=c.getContext('2d')
   x.fillStyle='#999';x.fillRect(0,0,480,640)
   x.fillStyle='#ccc';x.beginPath();x.ellipse(240,250,120,175,0,0,Math.PI*2);x.fill()
   x.fillStyle='#333';x.fillRect(175,270,25,9);x.fillRect(280,270,25,9)
   const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.8))
   return [...new Uint8Array(await blob.arrayBuffer())]
 })
 await page.locator('#photo-input').setInputFiles({name:'private-fixture.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg)})
 await ensurePhotoReady(page)
 await page.locator('#analyze').waitFor({state:'visible'})
 await page.locator('#consent').check()
 await page.locator('#analyze:enabled').click()
 await page.locator('#results:not([hidden])').waitFor()
 assert.equal(await page.locator('#result-title').innerText(),'Mixed Career Aura')
 assert.equal(await page.locator('#brand-match').isVisible(),false,'no invented company on a flat portrait')
 assert.equal(await page.locator('.fm-match').count(),5)
 assert.equal(await page.locator('#fm-scoring-details').isVisible(),true)
 await page.locator('#fm-scoring-details summary').click()
 assert.equal(await page.locator('.fm-cue-row').count(),8)
 assert.equal(await page.locator('.fm-chips span').count(),3)
 assert.equal(seen.length,1)
 assert.ok(seen[0].imageBase64?.length>200)
 assert.equal(seen[0].consent,true)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile result has no overflow')

 // Independently test crop geometry without making any model request or storing images.
 const crop=await page.evaluate(async(base64)=>{
   const bytes=Uint8Array.from(atob(base64),x=>x.charCodeAt(0))
   const blob=new Blob([bytes],{type:'image/jpeg'})
   const out=await cropForVisualStyle(blob,{originX:130,originY:130,width:180,height:230})
   const bm=await createImageBitmap(out)
   const data={width:bm.width,height:bm.height};bm.close();return data
 },Buffer.from(jpeg).toString('base64'))
 assert.ok(crop.width<480&&crop.height<640,'portrait crop removes excess clothing/context')
 assert.ok(crop.width>180&&crop.height>230,'portrait crop retains face margin')

 // A clear fictional style can still show verified company logos.
 scenario='finance'
 await page.locator('#reset').click()
 await page.locator('#photo-input').setInputFiles({name:'private-fixture.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpeg)})
 await ensurePhotoReady(page)
 await page.locator('#consent').check()
 await page.locator('#analyze:enabled').click()
 await page.locator('#results:not([hidden])').waitFor()
 assert.equal(await page.locator('#brand-name').innerText(),'Goldman Sachs')
 assert.equal(await page.locator('#brand-alternates .fm-brand-alt').count(),2)
 assert.deepEqual(errors,[])
 await context.close()
 console.log('PASS Face Match v3: mixed/no forced company, 8-cue disclosure, face-only crop, curated company and responsive UI')
}finally{await browser.close();await server.close()}
