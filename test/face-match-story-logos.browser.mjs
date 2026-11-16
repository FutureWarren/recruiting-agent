/** Story export uses 15 locally vendored real vector marks; no external logo CORS calls.
 * Browser/WebKit tests use only a synthetic portrait and mocked AI response.
 */
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit} from 'playwright'
process.env.SITE_TEST_ROOT='dist'
const {serve}=await import('./static-server.mjs')
const server=await serve()
const names={
 'goldmansachs.com':'goldmansachs','jpmorgan.com':'jpmorgan',
 'morganstanley.com':'morganstanley','mckinsey.com':'mckinsey',
 'bcg.com':'bcg','bain.com':'bain','google.com':'google',
 'meta.com':'meta','nvidia.com':'nvidia','notion.so':'notion',
 'figma.com':'figma','linear.app':'linear','salesforce.com':'salesforce',
 'airbnb.com':'airbnb','hubspot.com':'hubspot'
}
const basic={
 version:'photo-vibe-v2',methodology:'independent-photo-cues-v3',
 title:'Mixed Career Aura',mixed:true,
 subtitle:'More Than One Vibe Fits',tagline:'Calm Energy · Focused Look',
 explanation:'This image offers a fun, fictional visual mood.',
 tags:['Calm Energy','Focused Look','Bright Aura'],
 matches:[
  {id:'consulting',score:65},{id:'tech',score:65},
  {id:'wall-street',score:59},{id:'founder',score:49},
  {id:'client-facing',score:47}
 ],
 company:null,companyAlternates:[]
}
const finance={
 ...basic,title:'Wall Street Energy',mixed:false,
 matches:[
  {id:'wall-street',score:89},{id:'consulting',score:77},
  {id:'founder',score:68},{id:'tech',score:56},
  {id:'client-facing',score:48}
 ],
 company:{name:'Goldman Sachs',domain:'goldmansachs.com',category:'wall-street',mood:'Composed & classic'},
 companyAlternates:[
  {name:'J.P. Morgan',domain:'jpmorgan.com',category:'wall-street',mood:'Classic'},
  {name:'Morgan Stanley',domain:'morganstanley.com',category:'wall-street',mood:'Focused'}
 ]
}
for(const [engine,browserType] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await browserType.launch({headless:true})
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  const page=await ctx.newPage(),errors=[],requests=[]
  page.on('pageerror',e=>errors.push(e.message))
  await ctx.route('**/*',route=>{
   const u=new URL(route.request().url())
   if(u.origin===server.base){requests.push(u.pathname);return route.continue()}
   if(u.pathname==='/api/face-match/config')
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true})})
   if(['/api/public-tools/view','/api/public-tools/event','/api/handoff/event'].includes(u.pathname))
     return route.fulfill({status:204,body:''})
   return route.abort()
  })
  await page.goto(server.base+'/face-match/')
  // Every approved icon is a same-origin image that can be loaded AND rasterized
  // into a PNG canvas without tainting (important for iOS/WebKit Save Story).
  const assets=await page.evaluate(async domains=>{
    const results=[]
    for(const domain of domains){
      const image=await shareLogoImage({domain})
      if(!image){results.push({domain,ready:false});continue}
      const c=document.createElement('canvas');c.width=110;c.height=110
      const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,110,110)
      try{
        g.drawImage(image,7,7,96,96)
        const b=await new Promise(resolve=>c.toBlob(resolve,'image/png'))
        const px=g.getImageData(7,7,96,96).data
        let colored=0
        for(let i=0;i<px.length;i+=4){
          if(px[i]<225||px[i+1]<225||px[i+2]<225)colored++
        }
        results.push({domain,ready:Boolean(b?.size>200),colored})
      }catch(e){results.push({domain,ready:false,error:String(e)})}
    }
    return results
  },Object.keys(names))
  assert.deepEqual(assets.filter(a=>!a.ready),[],engine+' unable to render some local logo SVGs')
  assert.deepEqual(assets.filter(a=>a.colored<10),[],engine+' vector has no visible logo')

  // The actual live results page must render the same high-resolution SVGs,
  // including McKinsey and every other allowed backend company.
  const sectors={
    'goldmansachs.com':'wall-street','jpmorgan.com':'wall-street','morganstanley.com':'wall-street',
    'mckinsey.com':'consulting','bcg.com':'consulting','bain.com':'consulting',
    'google.com':'tech','meta.com':'tech','nvidia.com':'tech',
    'notion.so':'founder','figma.com':'founder','linear.app':'founder',
    'salesforce.com':'client-facing','airbnb.com':'client-facing','hubspot.com':'client-facing'
  }
  for(const [domain,slug] of Object.entries(names)){
    const sector=sectors[domain]
    const company={
      name:domain==='mckinsey.com'?'McKinsey & Company':domain.split('.')[0],
      domain,category:sector,mood:'A playful editorial reference'
    }
    const data={
      ...finance,company,
      companyAlternates:[
        {name:'NVIDIA',domain:'nvidia.com',category:'tech',mood:'Bold and modern'},
        {name:'BCG',domain:'bcg.com',category:'consulting',mood:'Bright and creative'}
      ]
    }
    await page.evaluate(value=>window.render(value),data)
    await page.waitForFunction(expected=>{
      const img=document.getElementById('brand-logo')
      const all=[...document.querySelectorAll('.fm-brand-alt .fm-brand-mark img,.fm-match-brand .fm-brand-mark img')]
      return img.dataset.logoDomain===expected&&img.naturalWidth>0&&!img.hidden&&
        all.length===7&&all.every(i=>i.naturalWidth>0&&!i.hidden)
    },domain,{timeout:8000})
    const result=await page.evaluate(()=>{
      const main=document.getElementById('brand-logo')
      const alt=[...document.querySelectorAll('.fm-brand-alt .fm-brand-mark img')]
      const ranked=[...document.querySelectorAll('.fm-match-brand .fm-brand-mark img')]
      return {
        mainSource:new URL(main.src).pathname,visible:!main.hidden,mode:main.parentElement.className,
        alternatives:alt.map(i=>({src:new URL(i.src).pathname,loaded:!i.hidden&&i.naturalWidth>0})),
        ranked:ranked.map(i=>({src:new URL(i.src).pathname,loaded:!i.hidden&&i.naturalWidth>0})),
        fallbackVisible:!document.getElementById('brand-fallback').hidden
      }
    })
    assert.equal(result.mainSource,'/face-match/brand-logos/'+slug+'.svg',engine+': '+domain+' must use its real local logo')
    assert.equal(result.visible,true,engine+': '+domain+' main logo should be visible')
    assert.equal(result.fallbackVisible,false,engine+': '+domain+' must not show monogram fallback')
    assert.equal(result.alternatives.length,2)
    assert.ok(result.alternatives.every(i=>i.src.startsWith('/face-match/brand-logos/')&&i.loaded),
      engine+': alternative logos must render from local SVGs')
    assert.equal(result.ranked.length,5)
    assert.ok(result.ranked.every(i=>i.src.startsWith('/face-match/brand-logos/')&&i.loaded),
      engine+': career list must contain all representative company logos')
  }
  assert.ok(!requests.some(x=>x.includes('s2/favicons')),'Never fetch Google favicons on the live result page')

  const story=await page.evaluate(async data=>{
    window.render(data)
    const image=document.getElementById('result-photo')
    const photo=document.createElement('canvas');photo.width=500;photo.height=680
    const p=photo.getContext('2d');p.fillStyle='#8a7997';p.fillRect(0,0,500,680)
    p.fillStyle='#c8ad9e';p.beginPath();p.ellipse(250,255,115,165,0,0,Math.PI*2);p.fill()
    p.fillStyle='#151020';p.fillRect(210,255,12,7);p.fillRect(275,255,12,7)
    image.src=photo.toDataURL('image/png')
    await image.decode()
    const result=await resultCanvas()
    const blob=await blobForShare()
    if(!blob)throw new Error('Cannot export Story PNG')
    // Pixel evidence that at least one colored mark appears inside top match tiles.
    const pixels=result.getContext('2d').getImageData(92,1056,199,62).data
    let nonWhite=0
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i]<212||pixels[i+1]<212||pixels[i+2]<212)nonWhite++
    }
    return {width:result.width,height:result.height,byteLength:blob.size,nonWhite}
  },basic)
  assert.equal(story.width,1080)
  assert.equal(story.height,1920)
  assert.ok(story.byteLength>10_000,engine+' Story should include photo, symbols and QR')
  assert.ok(story.nonWhite>30,engine+' top match should contain a real company SVG')
  const selected=await page.evaluate(async data=>{
    window.render(data)
    const logos=await shareImagesForReport(data)
    const canvas=await resultCanvas()
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))
    return {imageLoaded:logos.get('goldmansachs.com')?.naturalWidth>0,exported:blob?.size>10_000,
      selected:shareBrandForMatch(data,data.matches[0]).name}
  },finance)
  assert.equal(selected.imageLoaded,true)
  assert.equal(selected.exported,true)
  assert.equal(selected.selected,'Goldman Sachs')
  assert.deepEqual(errors,[])
  assert.ok(!requests.includes('/api/face-match/analyze'),'test must never call real AI provider')
  assert.ok(requests.some(x=>x.startsWith('/face-match/brand-logos/')),engine+' should load local vector assets')
  if(engine==='Chromium'){
   await mkdir('artifacts',{recursive:true})
   const png=await page.evaluate(async()=>{
    const canvas=await resultCanvas()
    return canvas.toDataURL('image/png').split(',')[1]
   })
   await writeFile('artifacts/face-match-story-logos.png',Buffer.from(png,'base64'))
  }
  await ctx.close()
  console.log('PASS '+engine+': 15 official-style local vector marks, dynamic company selection, default Story PNG and QR')
 }finally{await browser.close()}
}
await server.close()
