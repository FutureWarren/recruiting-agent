import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
const site='https://orbit-reaches.com',out='production-verification';mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={deployedCommit:'c1b1414db59938d6b3c8dc75a1d8b48c3a18f633',site,checkedAt:new Date().toISOString(),assets:[],desktop:null,mobile:null,errors:[]};
let browser;
try{
 let matched=false;for(let i=0;i<18;i++){const r=await fetch(site+'/?check=hd-c1b1414-'+i,{signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await r.arrayBuffer());if(r.ok&&hash(bytes)===hash(readFileSync('index.html'))){matched=true;break}await new Promise(r=>setTimeout(r,5000))}assert.ok(matched,'new HTML not yet live');
 for(const file of ['index.html','home.css','home.js','media/orbit-demo-hd.mp4','media/orbit-demo-hd-poster.jpg']){const r=await fetch(site+'/'+(file==='index.html'?'':file)+'?check=hd-c1b1414',{signal:AbortSignal.timeout(30000)});assert.ok(r.ok,file);const b=Buffer.from(await r.arrayBuffer()),actual=hash(b),expected=hash(readFileSync(file));assert.equal(actual,expected,file+' bytes differ');report.assets.push({path:file,status:r.status,bytes:b.length,sha256:actual,match:true})}
 browser=await chromium.launch({args:['--no-sandbox']});
 const mac=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,acceptDownloads:true,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'});
 await mac.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{configurable:true,get:()=>({platform:'macOS',getHighEntropyValues:async()=>({architecture:'arm'})})}));
 const p=await mac.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(site+'/?verify=hd-c1b1414',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.querySelector('#nav-download').dataset.downloadState==='ready');
 report.desktop=await p.evaluate(()=>({nav:document.querySelector('#nav-download').href,ctas:[...document.querySelectorAll('[data-orbit-download]')].map(e=>e.href),companyInHero:!!document.querySelector('#companies').closest('.hero-fold'),companyBottom:document.querySelector('#companies').getBoundingClientRect().bottom,secondSection:document.querySelector('main').children[1].id,noTutorial:!document.querySelector('.install-shell'),overflow:document.documentElement.scrollWidth>innerWidth,videoWidth:document.querySelector('#hero-demo').getBoundingClientRect().width}));
 assert.equal(report.desktop.secondSection,'demo');assert.equal(report.desktop.companyInHero,true);assert.ok(report.desktop.companyBottom<=902);assert.ok(report.desktop.videoWidth>=1100);assert.equal(report.desktop.noTutorial,true);assert.equal(report.desktop.overflow,false);assert.match(report.desktop.nav,/\/releases\/download\/[^/]+\/.*arm64\.dmg$/);assert.deepEqual(report.desktop.ctas,Array(3).fill(report.desktop.nav));
 await p.screenshot({path:out+'/desktop-hero-live.png'});
 const got=p.waitForEvent('download');await p.locator('#nav-download').click();const download=await got;report.desktop.download={url:download.url(),filename:download.suggestedFilename(),started:true,cancelledAfterStart:true};assert.match(download.suggestedFilename(),/arm64\.dmg$/);await download.cancel();assert.equal(await p.evaluate(()=>scrollY),0);
 await p.evaluate(()=>scrollTo(0,document.querySelector('#demo').getBoundingClientRect().top+scrollY-100));
 await p.waitForFunction(()=>document.querySelector('#hero-demo').readyState>=2);
 const media=await p.locator('#hero-demo').evaluate(e=>({width:e.videoWidth,height:e.videoHeight,duration:e.duration,currentSrc:e.currentSrc,controls:e.controls,playsInline:e.playsInline}));assert.equal(media.width,1920);assert.equal(media.height,1080);assert.ok(media.duration>35.8&&media.duration<36.1);assert.ok(media.controls&&media.playsInline);report.desktop.media=media;
 await p.locator('#hero-demo').evaluate(e=>{e.pause();e.currentTime=17});await p.waitForFunction(()=>!document.querySelector('#hero-demo').seeking);await p.waitForTimeout(400);await p.screenshot({path:out+'/desktop-demo-live.png'});
 await mac.close();
 const phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
 const m=await phone.newPage();m.on('pageerror',e=>report.errors.push(e.message));await m.goto(site+'/?verify=mobile-hd-c1b1414',{waitUntil:'domcontentloaded'});await m.waitForFunction(()=>document.querySelector('#nav-download').dataset.downloadState==='demo');
 report.mobile=await m.evaluate(()=>({ctas:[...document.querySelectorAll('[data-orbit-download]')].map(e=>e.getAttribute('href')),overflow:document.documentElement.scrollWidth>innerWidth,cursor:getComputedStyle(document.querySelector('.cursor-aura')).display,secondSection:document.querySelector('main').children[1].id,noTutorial:!document.querySelector('.install-shell')}));assert.deepEqual(report.mobile.ctas,['#demo','#demo','#demo']);assert.equal(report.mobile.overflow,false);assert.equal(report.mobile.cursor,'none');assert.equal(report.mobile.secondSection,'demo');assert.ok(report.mobile.noTutorial);await m.screenshot({path:out+'/mobile-hero-live.png'});
 await m.locator('#nav-download').click();await m.waitForFunction(()=>document.querySelector('#hero-demo').readyState>=2);report.mobile.media=await m.locator('#hero-demo').evaluate(e=>({width:e.videoWidth,height:e.videoHeight,cssWidth:e.getBoundingClientRect().width}));assert.equal(report.mobile.media.width,1920);assert.equal(report.mobile.media.height,1080);await m.locator('#hero-demo').evaluate(e=>e.pause());await m.screenshot({path:out+'/mobile-demo-live.png'});await phone.close();
 assert.deepEqual(report.errors,[]);report.success=true;console.log(JSON.stringify(report,null,2));
}finally{writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser?.close()}
