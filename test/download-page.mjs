/** Cross-platform download contracts, including historical/mixed releases. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import {serve,root} from './static-server.mjs';
const live=process.argv.includes('--live'),server=live?null:await serve();
const base=live?'https://orbit-reaches.com':server.base;
const browser=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
const UA={mac:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',win:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0',phone:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',linux:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0'};
const asset=(name,url)=>({name,size:120000000,browser_download_url:'https://example.test/'+url});
const release={tag_name:'v9.9.9',assets:[asset('Orbit-9.9.9-arm64.dmg','mac-arm64.dmg'),asset('Orbit-9.9.9.dmg','mac-x64.dmg'),asset('Orbit.Setup.9.9.9.exe','win.exe'),asset('Orbit.Setup.9.9.9-arm64.exe','win-arm.exe'),asset('latest-mac.yml','latest-mac.yml')]};
async function visit(ua,arch,data=release,touch=0,status=200){
 const context=await browser.newContext({userAgent:ua});
 await context.addInitScript(({arch,touch})=>{Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:()=>touch});if(arch)Object.defineProperty(navigator,'userAgentData',{configurable:true,get:()=>({platform:/Windows/.test(navigator.userAgent)?'Windows':'macOS',getHighEntropyValues:async()=>({architecture:arch})})})},{arch,touch});
 await context.route('**/api.github.com/**',r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base);await page.waitForFunction(()=>document.getElementById('dl-meta').textContent!=='Apple Silicon Mac · 300 free Orbit Credits');
  const state=await page.evaluate(()=>({href:document.querySelector('#dl-btn').getAttribute('href'),final:document.querySelector('#dl-btn-final').getAttribute('href'),label:document.querySelector('#dl-btn').textContent,meta:document.querySelector('#dl-meta').textContent,mac:!document.querySelector('#install-mac').hidden,win:!document.querySelector('#install-win').hidden,alts:document.querySelector('#dl-alts').textContent,resets:[...document.querySelectorAll('#download *')].filter(e=>/install/.test(getComputedStyle(e).counterReset)).length,steps:[...document.querySelectorAll('#download ol.install')].filter(e=>!e.hidden).flatMap(e=>[...e.children]).length,video:(()=>{const v=document.querySelector('#hero-demo');return {src:v.querySelector('source').getAttribute('src'),poster:v.getAttribute('poster'),inline:v.playsInline,muted:v.muted,loop:v.loop,controls:v.controls}})()}));
  assert.deepEqual(errors,[]);return state;
 }finally{await context.close()}
}
try{
 for(const [name,ua,arch] of [['Windows',UA.win,'x86'],['Windows ARM',UA.win,'arm'],['Intel Mac',UA.mac,'x86'],['Linux',UA.linux,null]]){const s=await visit(ua,arch);assert.equal(s.href,null,name);assert.equal(s.final,null);assert.match(s.meta,/Apple Silicon Mac only/);assert.equal(s.mac||s.win,false);assert.doesNotMatch(s.alts,/Windows|Intel/)}
 const mac=await visit(UA.mac,'arm');assert.equal(mac.href,'https://example.test/mac-arm64.dmg');assert.equal(mac.final,mac.href);assert.match(mac.label,/Mac/);assert.match(mac.meta,/9\.9\.9.*300 free Orbit Credits/);assert.equal(mac.mac,true);assert.equal(mac.win,false);assert.equal(mac.resets,1);assert.equal(mac.steps,4);assert.doesNotMatch(mac.alts,/Windows|Intel/);
 for(const [ua,touch] of [[UA.phone,0],[UA.mac,5]]){const s=await visit(ua,null,release,touch);assert.equal(s.href,'#demo');assert.equal(s.final,'#demo');assert.equal(s.label,'Watch Orbit work');assert.match(s.meta,/Apple Silicon Mac/);assert.equal(s.video.controls,true)}
 const historical={tag_name:'v0.1.19',assets:[asset('Recruiting-Agent-0.1.19-arm64.dmg','mac-arm64.dmg'),asset('Recruiting-Agent-Setup-0.1.19.exe','universal.exe')]};assert.equal((await visit(UA.win,'x86',historical)).href,null);
 const mixed={tag_name:'v0.1.35',assets:[asset('Orbit-0.1.34-arm64.dmg','mac-old.dmg'),asset('Orbit-Setup-0.1.35.exe','new-win.exe')]};const m=await visit(UA.mac,'arm',mixed);assert.equal(m.href,'https://example.test/mac-old.dmg');assert.match(m.meta,/Version 0\.1\.34/);
 for(const [data,status] of [{tag_name:'v1.0.0',assets:[asset('Orbit-x64.dmg','wrong.dmg')]},{}].map((d,i)=>[d,i?403:200])){const s=await visit(UA.mac,'arm',data,0,status);assert.match(s.href,/releases\/latest$/);assert.match(s.meta,/300 free Orbit Credits/)}
 assert.deepEqual(mac.video,{src:'media/orbit-demo.mp4',poster:'media/orbit-demo-poster.jpg',inline:true,muted:true,loop:true,controls:true});for(const file of ['media/orbit-demo.mp4','media/orbit-demo-poster.jpg','home.css','home.js'])assert.ok(existsSync(join(root,file)),file);
 console.log('Download contracts passed: platforms, touch iPad, historic/mixed assets, missing build/API failure, free allowance, controls and install numbering.');
}finally{await browser.close();await server?.close()}
