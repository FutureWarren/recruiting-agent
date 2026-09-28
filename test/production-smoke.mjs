/** Read-only post-deployment QA. No API stubs, no writes to production. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
const base='https://orbit-reaches.com',out='production-verification';
mkdirSync(out,{recursive:true});
const report={deployedCommit:'8fb444dcc4203754c77a2a9b388c6d0efe810c08',checkedAt:new Date().toISOString(),site:base,assets:[],routes:[],checks:[],errors:[]};
const check=(name,ok,detail={})=>{report.checks.push({name,ok,...detail});assert.ok(ok,name)};
const sha=b=>createHash('sha256').update(b).digest('hex');
let browser;
try{
 for(const path of ['index.html','home.css','home.js','media/orbit-demo.mp4','media/orbit-demo-poster.jpg']){
  const expected=sha(readFileSync(path));let result;
  for(let attempt=0;attempt<4;attempt++){
   const url=base+'/'+(path==='index.html'?'':path)+(attempt?'?verify=8fb444d-'+Date.now():'');
   try{const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}}),b=Buffer.from(await r.arrayBuffer());result={path,status:r.status,bytes:b.length,sha256:sha(b),expected,match:r.ok&&sha(b)===expected};if(result.match)break}catch(e){result={path,error:String(e),match:false}}
   if(attempt<3)await new Promise(r=>setTimeout(r,5000));
  }
  report.assets.push(result);check('Live bytes match approved '+path,result.match);
 }
 for(const path of ['/pricing/','/privacy/','/terms/','/refunds/','/support/']){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});report.routes.push({path,status:r.status});check('Route '+path,r.ok);await r.arrayBuffer()}
 browser=await chromium.launch({args:['--no-sandbox']});
 const mac=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'});
 await mac.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{configurable:true,get:()=>({platform:'macOS',getHighEntropyValues:async()=>({architecture:'arm'})})}));
 const p=await mac.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 check('Production HTTPS home loads',(await p.goto(base,{waitUntil:'networkidle',timeout:30000})).ok());
 await p.waitForFunction(()=>document.querySelector('#dl-meta').textContent.includes('Version')||document.querySelector('#dl-meta').textContent.includes('open releases'),{timeout:15000});
 const href=await p.locator('#dl-btn').getAttribute('href'),meta=await p.locator('#dl-meta').textContent();
 check('Mac primary CTA resolves to released arm64 DMG',/^https:\/\/github\.com\/FutureWarren\/recruiting-agent\/releases\/download\/[^/]+\/[^/]*arm64\.dmg$/.test(href||''),{href,meta});
 check('Free allowance remains visible',meta.includes('300 free Orbit Credits'));
 check('Desktop no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('Original circular logo exists',await p.locator('.brand-ring').count()===1&&await p.locator('.satellite-dot').count()===1);
 await p.mouse.move(600,230);await p.screenshot({path:out+'/desktop-live.png'});
 const card=p.locator('.float-card').first(),r=await card.boundingBox();
 await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2+42,r.y+r.height/2+28,{steps:12});await p.waitForTimeout(250);
 check('Live card follows drag',await card.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41)>25);
 await p.mouse.up();await p.mouse.move(600,230);await p.waitForTimeout(1200);
 check('Live card springs back',Math.abs(await card.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41))<.5);
 check('Native-safe pointer follower is visible',await p.locator('.cursor-aura').evaluate(e=>Number(getComputedStyle(e).opacity)>.9&&getComputedStyle(e).pointerEvents==='none'));
 const geom=await p.locator('.story').evaluate(e=>({top:e.getBoundingClientRect().top+scrollY,height:e.offsetHeight}));
 for(const step of [0,1,3,1]){await p.evaluate(y=>scrollTo(0,y),geom.top-100+(step/3)*(geom.height-750));await p.waitForTimeout(120);check('Live scroll reaches stage '+step,await p.locator('.story-stage').getAttribute('data-step')===String(step))}
 await p.locator('#companies').scrollIntoViewIfNeeded();const strip=p.locator('.company-window');await strip.focus();const before=await p.locator('.company-track').evaluate(e=>e.style.transform);await p.keyboard.press('ArrowRight');await p.waitForTimeout(100);check('Live company strip responds',await p.locator('.company-track').evaluate(e=>e.style.transform)!==before);
 await p.locator('#hero-demo').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('#hero-demo').readyState>=1,{timeout:15000});check('Live demo metadata loads',await p.locator('#hero-demo').evaluate(e=>e.videoWidth>0&&e.controls));
 await mac.close();
 const phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'}),m=await phone.newPage();m.on('pageerror',e=>report.errors.push(e.message));
 await m.goto(base,{waitUntil:'networkidle',timeout:30000});
 check('Mobile primary CTA opens demo',await m.locator('#dl-btn').getAttribute('href')==='#demo');
 check('Mobile no horizontal overflow',await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('Mobile pointer follower disabled',await m.locator('.cursor-aura').evaluate(e=>getComputedStyle(e).display==='none'));
 await m.screenshot({path:out+'/mobile-live.png'});
 await m.locator('.story-step').nth(2).click();check('Mobile chapter selection works',await m.locator('.story-stage').getAttribute('data-step')==='2');
 await m.locator('#motion-toggle').click();check('Global motion pause works',(await m.locator('body').getAttribute('class')).includes('motion-off'));
 await phone.close();check('No page JavaScript errors',report.errors.length===0);report.success=true;
}catch(e){report.success=false;report.failure=String(e);process.exitCode=1}
finally{await browser?.close();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
