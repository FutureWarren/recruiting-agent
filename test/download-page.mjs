/** All CTAs must resolve the same supported installer, not the removed tutorial. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {serve} from './static-server.mjs';
const live=process.argv.includes('--live'),server=live?null:await serve();
const base=live?'https://orbit-reaches.com':server.base;
const browser=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
const UA={mac:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',win:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0',phone:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',linux:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0'};
const asset=(name,url)=>({name,size:120000000,browser_download_url:'https://example.test/'+url});
const release={tag_name:'v9.9.9',assets:[asset('Orbit-9.9.9-arm64.dmg','mac-arm64.dmg'),asset('Orbit-9.9.9.dmg','mac-x64.dmg'),asset('Orbit.Setup.9.9.9.exe','win.exe'),asset('Orbit.Setup.9.9.9-arm64.exe','win-arm.exe'),asset('latest-mac.yml','latest-mac.yml')]};
async function visit(ua,arch,data=release,touch=0,status=200,downloadClick=false,delay=0,viewport){
 const context=await browser.newContext({userAgent:ua,acceptDownloads:true,...(viewport?{viewport}:{})});
 await context.addInitScript(({arch,touch})=>{Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:()=>touch});if(arch)Object.defineProperty(navigator,'userAgentData',{configurable:true,get:()=>({platform:/Windows/.test(navigator.userAgent)?'Windows':'macOS',getHighEntropyValues:async()=>({architecture:arch})})})},{arch,touch});
 await context.route('**/api.github.com/**',async r=>{if(delay)await new Promise(resolve=>setTimeout(resolve,delay));await r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})});
 await context.route('https://example.test/**',r=>r.fulfill({status:200,headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="Orbit-test-arm64.dmg"'},body:'test-installer-fixture'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  if(downloadClick&&delay){const got=page.waitForEvent('download');await page.locator('#nav-download').click();const download=await got;assert.equal(download.suggestedFilename(),'Orbit-test-arm64.dmg');await download.delete()}
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-orbit-download]')].every(b=>b.dataset.downloadState&&b.dataset.downloadState!=='loading'));
  const s=await page.evaluate(()=>{
   const notice=document.querySelector('#mobile-desktop-reminder'),rect=notice.getBoundingClientRect();
   return {links:[...document.querySelectorAll('[data-orbit-download]')].map(b=>b.getAttribute('href')),states:[...document.querySelectorAll('[data-orbit-download]')].map(b=>b.dataset.downloadState),nav:document.querySelector('#nav-download').textContent,meta:document.querySelector('#dl-meta').textContent,instructions:document.querySelectorAll('.install-shell,#install-mac,#install-win').length,noticeVisible:notice.getClientRects().length>0,noticeText:notice.textContent,noticeAfterActions:document.querySelector('.hero-copy .actions').nextElementSibling===notice,noticeFits:rect.left>=0&&rect.right<=innerWidth,finalNotice:document.querySelector('#download .desktop-requirement').textContent};
  });
  assert.equal(s.noticeAfterActions,true,'The device reminder belongs directly below the first-screen actions');
  assert.match(s.finalNotice,/Apple Silicon Mac required.*Not available on phones or tablets/);
  if(downloadClick&&!delay){const got=page.waitForEvent('download');await page.locator('#nav-download').click();const d=await got;assert.equal(d.suggestedFilename(),'Orbit-test-arm64.dmg');await d.delete();assert.equal(await page.evaluate(()=>scrollY),0,'Get Orbit must not jump to tutorials')}
  assert.deepEqual(errors,[]);return s;
 }finally{await context.close()}
}
try{
 for(const [name,ua,arch] of [['Windows',UA.win,'x86'],['Windows ARM',UA.win,'arm'],['Intel Mac',UA.mac,'x86'],['Linux',UA.linux,null]]){const s=await visit(ua,arch);assert.deepEqual(s.links,[null,null,null],name);assert.match(s.meta,/Apple Silicon Mac only/);assert.equal(s.instructions,0)}
 const mac=await visit(UA.mac,'arm',release,0,200,true);assert.deepEqual(mac.links,Array(3).fill('https://example.test/mac-arm64.dmg'));assert.match(mac.nav,/Get Orbit/);assert.match(mac.meta,/9\.9\.9.*300 free Orbit Credits/);assert.equal(mac.instructions,0);assert.equal(mac.noticeVisible,false,'Do not add the mobile callout to the desktop hero');
 await visit(UA.mac,'arm',release,0,200,true,600);
 for(const [ua,touch] of [[UA.phone,0],[UA.mac,5]]){const s=await visit(ua,null,release,touch);assert.deepEqual(s.links,['#demo','#demo','#demo']);assert.equal(s.nav,'Watch demo');assert.match(s.meta,/Apple Silicon Mac/);assert.equal(s.noticeVisible,true,'Phone and desktop-mode iPad must see the desktop requirement');assert.match(s.noticeText,/Orbit runs on your computer.*Not on phones or tablets.*Watch the demo here/)}
 for(const width of [320,390,768,1024]){const s=await visit(UA.phone,null,release,0,200,false,0,{width,height:844});assert.equal(s.noticeVisible,true,'Visible at '+width+'px');assert.equal(s.noticeFits,true,'The reminder must not overflow at '+width+'px');assert.deepEqual(s.links,['#demo','#demo','#demo'])}
 const noJs=await browser.newContext({userAgent:UA.phone,viewport:{width:390,height:844},javaScriptEnabled:false});
 try{const page=await noJs.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});assert.equal(await page.locator('#mobile-desktop-reminder').isVisible(),true,'The phone reminder must not depend on JavaScript')}finally{await noJs.close()}
 const mixed={tag_name:'v0.1.35',assets:[asset('Orbit-0.1.34-arm64.dmg','mac-old.dmg'),asset('Orbit-Setup-0.1.35.exe','new-win.exe')]};const m=await visit(UA.mac,'arm',mixed);assert.deepEqual(m.links,Array(3).fill('https://example.test/mac-old.dmg'));assert.match(m.meta,/Version 0\.1\.34/);
 const historical={tag_name:'v0.1.19',assets:[asset('Recruiting-Agent-0.1.19-arm64.dmg','mac-arm64.dmg'),asset('Recruiting-Agent-Setup-0.1.19.exe','universal.exe')]};assert.deepEqual((await visit(UA.win,'x86',historical)).links,[null,null,null]);
 for(const [data,status] of [[{tag_name:'v1.0.0',assets:[asset('Orbit-x64.dmg','wrong.dmg')]},200],[{},403]]){const s=await visit(UA.mac,'arm',data,status===200?0:0,status);s.links.forEach(h=>assert.match(h,/releases\/latest$/));assert.match(s.meta,/300 free Orbit Credits/)}
 console.log('PASS download: all three CTAs, actual download event, early click, phone/iPad desktop reminder, 320–1024px notice fit, no-JS reminder, Windows/Intel, mixed releases, API fallback, tutorial removed.');
}finally{await browser.close();await server?.close()}
