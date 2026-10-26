/** Approved mobile-first experience, without weakening any desktop contract. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {chromium,webkit} from 'playwright-core';
import {serve,root} from './static-server.mjs';
const html=readFileSync(join(root,'index.html'),'utf8');
const gitHash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(gitHash(readFileSync(join(root,'home.js'))),'e13ea8f63dde02299758c6d6246f33204bf56349','desktop JS must remain byte-identical');
assert.equal(gitHash(readFileSync(join(root,'home.css'))),'8a81c8ff98c47cb84c65deb64177c028183a58d7','desktop CSS must remain byte-identical');
const baseline=html.replace(/<!-- Mobile-only first-paint handoff[^]*?<link rel="stylesheet" href="mobile\.css[^]*?>\n/,'').replace(/<script src="mobile\.js[^]*?<\/script>\n/,'').replace(/<a href="\/unsubscribe\/">Email preferences<\/a>/,'');
assert.match(html, /href="\/unsubscribe\/">Email preferences<\/a>/, 'website provides a visible preferences link');
assert.equal(gitHash(baseline.replace(/<meta property="og:url"[^]*?<\/script>\n/,'').replace(/<section id="recruiting-resources"[^]*?<\/section>\n/,'')),'5849da12c8d2be31cca6c3671d63bb65bf202af6','existing desktop HTML must remain byte-identical after removing isolated mobile assets');
assert.equal(gitHash(readFileSync(join(root,'media/orbit-demo-hd.mp4'))),'bf4cacfb1bc00fe0ad8e7a05bb7356951fb399a1','reuse the actual approved demo unchanged');
const server=await serve();mkdirSync(join(root,'artifacts'),{recursive:true});
const UA={phone:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',android:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',mac:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0',win:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0'};
const fixtures=[{tag_name:'v9.9.9',assets:[{name:'Orbit-9.9.9-arm64.dmg',size:120000000,browser_download_url:'https://example.test/mac.dmg'},{name:'Orbit-9.9.9-x64-Setup.exe',size:120000000,browser_download_url:'https://example.test/win.exe'}]}];
async function setup(browser,options={},status='delivered'){
 const ctx=await browser.newContext({viewport:{width:390,height:750},userAgent:UA.phone,isMobile:true,hasTouch:true,reducedMotion:'reduce',...options});
 ctx.setDefaultTimeout(12000);ctx.setDefaultNavigationTimeout(15000);
 const requests=[];const errors=[];
 await ctx.route('https://backend-production-2b40.up.railway.app/**',route=>{
  const req=route.request();requests.push({url:req.url(),body:req.postDataJSON()});
  if(req.url().endsWith('/start'))return route.fulfill({status:status==='error'?500:200,contentType:'application/json',body:JSON.stringify(status==='error'?{error:'Please try again.'}:{emailStatus:status,continueUrl:'https://orbit-reaches.com/continue/?token=test-only-token'})});
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await ctx.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixtures)}));
 await ctx.route('https://example.test/**',r=>r.abort());
 await ctx.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}}));
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {ctx,page,requests,errors};
}
try{
 for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(engineName==='chromium'?{...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']}:{});
  try{
   for(const [name,width,height,ua,touch] of [['iphone',390,750,UA.phone,1],['small-phone',320,568,UA.phone,1],['android',360,740,UA.android,1],['ipad-landscape',1024,768,UA.mac,5]]){
    console.log('CHECK '+engineName+' '+name);
    const t=await setup(browser,{viewport:{width,height},userAgent:ua});
    await t.ctx.addInitScript(n=>Object.defineProperty(navigator,'maxTouchPoints',{get:()=>n}),touch);
    await t.page.goto(server.base+'/?source=internal_test&utm_campaign=mobile_first');
    assert.equal(await t.page.locator('#mobile-handoff-email').isVisible(),true,name+' immediate email');
    assert.equal(await t.page.evaluate(()=>document.activeElement.id==='mobile-handoff-email'),false,'no automatic keyboard or fake form start');
    assert.equal(t.requests.some(r=>['cta_clicked_v2','email_started_v2'].includes(r.body?.stage)),false);
    assert.equal(await t.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');
    const info=await t.page.locator('#hero-demo').evaluate(e=>({hero:!!e.closest('.hero-copy'),src:e.querySelector('source').getAttribute('src'),y:e.getBoundingClientRect().top}));
    assert.equal(info.hero,true);assert.equal(info.src,'media/orbit-demo-hd.mp4');assert.ok(info.y<320);
    assert.equal(await t.page.locator('#mobile-handoff-form input').count(),1,'only email required');
    await t.page.locator('#mobile-copy-before').click();
    const copied=new URL(await t.page.evaluate(()=>window.__copied));assert.equal(copied.origin,'https://orbit-reaches.com');assert.equal(copied.searchParams.get('utm_campaign'),'mobile_first');assert.equal(t.requests.some(r=>r.url.endsWith('/start')),false);
    await t.page.locator('.mobile-handoff-close').click();await t.page.waitForFunction(()=>document.getElementById('mobile-handoff-modal').hidden);
    assert.equal(await t.page.locator('main').evaluate(e=>e.inert),false);
    if(name==='iphone')await t.page.screenshot({path:join(root,'artifacts',engineName+'-mobile-hero.png')});
    await t.page.locator('#nav-download').click();await t.page.locator('#mobile-handoff-email').fill('student@example.com');
    await t.page.locator('#mobile-handoff-submit').click();await t.page.waitForSelector('#mobile-handoff-success:not([hidden])');
    assert.equal(t.requests.filter(r=>r.url.endsWith('/start')).length,1);
    const body=t.requests.find(r=>r.url.endsWith('/start')).body;assert.equal(body.email,'student@example.com');assert.equal(body.source,'internal_test');assert.equal(body.funnelVersion,2);assert.equal(body.platform,'mobile');
    assert.equal(await t.page.locator('#mobile-handoff-copy').isVisible(),true);assert.deepEqual(t.errors,[]);
    await t.ctx.close();console.log('PASS '+engineName+' '+name);
   }
   // CSS-only first paint while both deferred assets are deliberately held back.
   console.log('CHECK '+engineName+' first paint with deferred scripts held');
   const first=await setup(browser);let release;const gate=new Promise(r=>release=r);
   await first.ctx.route(/\/(mobile|home)\.js\?/,async r=>{await gate;await r.continue()});
   try {
    await first.page.goto(server.base+'/?source=internal_test',{waitUntil:'commit'});
    await first.page.locator('#mobile-handoff-email').waitFor({state:'visible'});
    assert.equal(await first.page.locator('html').evaluate(e=>e.classList.contains('orbit-mobile-pending')),true);
    release();await first.page.waitForLoadState('domcontentloaded');
    assert.equal(first.requests.some(r=>['cta_clicked_v2','email_started_v2'].includes(r.body?.stage)),false);
   } finally { release();await first.ctx.close(); }
   console.log('PASS '+engineName+' first paint');
   for(const status of ['accepted','failed','error']){
    console.log('CHECK '+engineName+' email '+status);
    const t=await setup(browser,{},status);await t.page.goto(server.base+'/?source=internal_test');
    await t.page.locator('#mobile-handoff-email').fill('not-an-email');await t.page.locator('#mobile-handoff-submit').click();assert.equal(t.requests.some(r=>r.url.endsWith('/start')),false);
    await t.page.locator('#mobile-handoff-email').fill('anyone@gmail.com');await t.page.locator('#mobile-handoff-submit').click();
    if(status==='error'){await t.page.locator('#mobile-handoff-error').waitFor({state:'visible'});assert.equal(await t.page.locator('#mobile-copy-before').isVisible(),true)}
    else{await t.page.waitForSelector('#mobile-handoff-success:not([hidden])');assert.doesNotMatch(await t.page.locator('#mobile-handoff-success-copy').textContent(),/We delivered/);assert.equal(await t.page.locator('#mobile-handoff-copy').isVisible(),true)}
    assert.deepEqual(t.errors,[]);await t.ctx.close();
   }
   console.log('CHECK '+engineName+' restricted clipboard');
   const denied=await setup(browser);
   await denied.page.goto(server.base+'/?source=internal_test&email=must-not-leak@example.com&token=must-not-leak');await denied.page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));await denied.page.locator('#mobile-copy-before').click();
   assert.equal(await denied.page.locator('#mobile-copy-backup').isVisible(),true);assert.doesNotMatch(await denied.page.locator('#mobile-copy-backup').inputValue(),/must-not-leak/);assert.equal(denied.requests.some(r=>r.url.endsWith('/start')),false);await denied.ctx.close();
   // Verify carousel geometry/content/styles separately from nondeterministic composited text.
   // Compare the rest of the desktop pixels exactly; the existing interaction suite tests motion.
   if(engineName==='chromium')for(const ua of [UA.mac,UA.win])for(const width of [640,1440]){
    const platform=/Windows/.test(ua)?'windows':'mac';
    console.log('CHECK desktop exact pixels '+platform+' '+width);
    const t=await setup(browser,{userAgent:ua,isMobile:false,hasTouch:false,viewport:{width,height:900}});
    await t.ctx.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{get:()=>({platform:/Windows/.test(navigator.userAgent)?'Windows':'macOS',getHighEntropyValues:async()=>({architecture:/Windows/.test(navigator.userAgent)?'x86':'arm'})})}));
    await t.ctx.route('**/baseline.html*',r=>r.fulfill({contentType:'text/html',body:baseline}));
    const images=[],carousels=[];
    for(const url of [server.base+'/baseline.html?source=internal_test',server.base+'/?source=internal_test']){
     await t.page.goto(url);await t.page.waitForFunction(()=>document.getElementById('dl-btn').dataset.downloadState==='ready');
     // The new legal preferences link is tested for presence, then excluded solely from
     // pixel parity so every pre-existing desktop visual remains byte-exact.
     if (!url.includes('/baseline.html')) {
      const preferences=t.page.locator('.footer-links a[href="/unsubscribe/"]');
      assert.equal(await preferences.count(),1,'preferences footer link present');
      await preferences.evaluate(el=>el.remove());
     }
     assert.equal(await t.page.locator('#mobile-handoff-modal').isVisible(),false);assert.equal(await t.page.locator('#hero-demo').evaluate(e=>!!e.closest('#demo')),true);
     await t.page.addStyleTag({content:'video{visibility:hidden!important}.company-track{transform:translate3d(0,0,0)!important}'});
     await t.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     carousels.push(await t.page.evaluate(()=>[...document.querySelectorAll('.company-window,.company-track,.company-name')].map(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height,font:s.font,color:s.color,spacing:s.letterSpacing,opacity:s.opacity,transform:s.transform,mask:s.maskImage};
     })));
     // The unchanged carousel can differ only in GPU text rasterization between navigations.
     await t.page.addStyleTag({content:'.company-track{visibility:hidden!important}'});
     images.push(await t.page.screenshot({fullPage:true,animations:'disabled'}));
    }
    writeFileSync(join(root,'artifacts','desktop-'+platform+'-'+width+'-before.png'),images[0]);
    writeFileSync(join(root,'artifacts','desktop-'+platform+'-'+width+'-after.png'),images[1]);
    assert.deepEqual(carousels[0],carousels[1],'desktop carousel geometry/content/styles changed');
    assert.equal(images[0].equals(images[1]),true,'desktop pixels changed: '+platform+' '+width+'px; see before/after artifacts');assert.deepEqual(t.errors,[]);await t.ctx.close();
   }
   console.log('PASS '+engineName+': immediate email without CTA, one-field capture, real demo in hero, no-email copy/fallback, errors, phone/iPad layout and desktop isolation.');
  }finally{await browser.close()}
 }
}finally{await server.close()}
