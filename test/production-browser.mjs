/** CI checks the built artifact in real browser engines, with every external
 * request mocked/blocked. Never send email, create telemetry or download apps. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
process.env.SITE_TEST_ROOT='dist';
const { serve }=await import('./static-server.mjs');
const server=await serve();
await mkdir('artifacts/production-review',{recursive:true});
const UA={phone:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',android:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',mac:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0',win:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0'};
const releases=[{tag_name:'v9.9.9',assets:[{name:'Orbit-9.9.9-arm64.dmg',size:120000000,browser_download_url:'https://example.test/mac.dmg'},{name:'Orbit-9.9.9-x64-Setup.exe',size:120000000,browser_download_url:'https://example.test/win.exe'}]}];
async function setup(browser,{ua=UA.phone,width=390,height=844,touch=1,arch='arm',status='delivered',reduced='reduce',releaseFailure=false}={}) {
  const ctx=await browser.newContext({viewport:{width,height},userAgent:ua,hasTouch:touch>0,reducedMotion:reduced});
  const requests=[],errors=[];
  await ctx.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===server.base)return route.continue();
    if(url.host==='api.github.com')return route.fulfill({status:releaseFailure?503:200,contentType:'application/json',body:JSON.stringify(releases)});
    if(url.host==='backend-production-2b40.up.railway.app') {
      requests.push({path:url.pathname,body:req.postDataJSON()});
      if(url.pathname==='/api/handoff/start')return route.fulfill({status:status==='error'?500:200,contentType:'application/json',body:JSON.stringify(status==='error'?{error:'Please try again.'}:{emailStatus:status,continueUrl:server.base+'/continue/?token=abcdefghijklmnopqrstuvwx.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ'})});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({firstName:'',goal:'',detail:'',items:[]})});
    }
    return route.abort();
  });
  await ctx.addInitScript(({touch,arch})=>{
    Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:()=>touch});
    Object.defineProperty(navigator,'userAgentData',{configurable:true,get:()=>({platform:/Windows/.test(navigator.userAgent)?'Windows':'macOS',getHighEntropyValues:async()=>({architecture:arch})})});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}});
  },{touch,arch});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  return {ctx,page,requests,errors};
}
const noOverflow=async(page,label)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' overflow');
const noSend=t=>assert.equal(t.requests.filter(r=>r.path==='/api/handoff/start').length,0,'no email before explicit submit');
try {
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
    const browser=await engine.launch({headless:true});
    try {
      for(const [device,width,height,ua,touch] of [['phone',390,844,UA.phone,1],['small-phone',320,568,UA.phone,1],['android',360,740,UA.android,1],['ipad',1024,768,UA.mac,5]]) {
        const t=await setup(browser,{ua,width,height,touch});
        await t.page.goto(server.base+'/?source=internal_test&utm_campaign=approved_design');
        await t.page.locator('#mobile-handoff-modal.is-open').waitFor();
        assert.equal(await t.page.locator('#mobile-handoff-form input').count(),1);
        assert.equal(await t.page.locator('#mobile-handoff-email').isVisible(),true);
        assert.equal(await t.page.evaluate(()=>document.activeElement.id==='mobile-handoff-email'),false,'do not raise keyboard automatically');
        assert.equal(t.requests.some(r=>['cta_clicked_v2','email_started_v2'].includes(r.body?.stage)),false,'automatic display is not intent');
        noSend(t);await noOverflow(t.page,device);
        assert.equal(await t.page.locator('#hero-demo').evaluate(e=>!!e.closest('.hero-copy')),true);
        await t.page.locator('#mobile-copy-before').click();noSend(t);
        const copied=new URL(await t.page.evaluate(()=>window.__copied));assert.equal(copied.origin,'https://orbit-reaches.com');assert.equal(copied.searchParams.get('utm_campaign'),'approved_design');
        await t.page.locator('.mobile-handoff-close').click();await t.page.locator('#mobile-handoff-modal').waitFor({state:'hidden'});
        assert.equal(await t.page.locator('main').evaluate(e=>e.inert),false);
        for(const section of ['#companies','#numbers','#profile','#download']) {await t.page.locator(section).scrollIntoViewIfNeeded();assert.equal(await t.page.locator(section).isVisible(),true);}
        await noOverflow(t.page,device+' full page');
        await t.page.locator('#dl-btn-final').click();await t.page.locator('#mobile-handoff-email').waitFor({state:'visible'});
        await t.page.locator('#mobile-handoff-email').fill('not-an-email');await t.page.locator('#mobile-handoff-submit').click();noSend(t);
        await t.page.locator('#mobile-handoff-email').fill('fixture@example.test');await t.page.locator('#mobile-handoff-submit').click();
        await t.page.locator('#mobile-handoff-success:not([hidden])').waitFor();
        assert.match(await t.page.locator('#mobile-handoff-success-title').innerText(),/Check your inbox/);
        const calls=t.requests.filter(r=>r.path==='/api/handoff/start');assert.equal(calls.length,1);assert.equal(calls[0].body.platform,'mobile');assert.equal(calls[0].body.funnelVersion,2);assert.equal(calls[0].body.firstName,undefined);assert.equal(calls[0].body.goal,undefined);
        assert.equal(await t.page.locator('#mobile-handoff-copy').isVisible(),true);assert.deepEqual(t.errors,[]);
        await t.page.screenshot({path:`artifacts/production-review/${name}-${device}.png`});
        await t.ctx.close();console.log(`PASS ${name} ${device}: immediate sheet, one field, copy, reopen, mocked submit, layout`);
      }
      for(const status of ['accepted','failed','error']) {
        const t=await setup(browser,{status});await t.page.goto(server.base);
        await t.page.locator('#mobile-handoff-email').fill('fixture@example.test');await t.page.locator('#mobile-handoff-submit').click();
        if(status==='error') {await t.page.locator('#mobile-handoff-error').waitFor({state:'visible'});assert.equal(await t.page.locator('#mobile-copy-before').isVisible(),true);}
        else {await t.page.locator('#mobile-handoff-success:not([hidden])').waitFor();assert.doesNotMatch(await t.page.locator('#mobile-handoff-success-copy').innerText(),/We delivered/);assert.equal(await t.page.locator('#mobile-handoff-copy').isVisible(),true);}
        assert.deepEqual(t.errors,[]);await t.ctx.close();console.log(`PASS ${name} delivery state ${status}`);
      }
      for(const [device,ua,arch,expected] of [['mac',UA.mac,'arm','https://example.test/mac.dmg'],['win',UA.win,'x86','https://example.test/win.exe'],['intel',UA.mac,'x86',null],['win-arm',UA.win,'arm',null]]) {
        const t=await setup(browser,{ua,arch,touch:0,width:1280,height:800});await t.page.goto(server.base);
        await t.page.waitForFunction(()=>!['loading',undefined].includes(document.querySelector('#dl-btn').dataset.downloadState));
        for(const a of await t.page.locator('[data-orbit-download]').all()) assert.equal(await a.getAttribute('href'),expected);
        assert.equal(await t.page.locator('#mobile-handoff-modal').isVisible(),false);noSend(t);await noOverflow(t.page,device);assert.deepEqual(t.errors,[]);await t.ctx.close();
        console.log(`PASS ${name} ${device}: installer routing and desktop isolation`);
      }
      const fallback=await setup(browser,{ua:UA.mac,arch:'arm',touch:0,releaseFailure:true});await fallback.page.goto(server.base);await fallback.page.waitForFunction(()=>document.querySelector('#dl-btn').dataset.downloadState==='fallback');assert.equal(await fallback.page.locator('#dl-btn').getAttribute('href'),'https://github.com/FutureWarren/recruiting-agent/releases');await fallback.ctx.close();
      for(const width of [375,1440]) {
        const t=await setup(browser,{ua:UA.mac,touch:0,width,height:900});
        for(const path of ['','pricing','support','recruiting-guide','recruiting-news','privacy','terms','refunds','unsubscribe','start','continue']) {
          const response=await t.page.goto(server.base+'/'+(path?path+'/':''));assert.ok(response.ok());await noOverflow(t.page,`${path} ${width}`);
          assert.ok((await t.page.locator('main').innerText()).trim().length>0);
          if(['','pricing','start'].includes(path))await t.page.screenshot({path:`artifacts/production-review/${name}-${path||'home'}-${width}.png`,fullPage:true});
        }
        noSend(t);assert.deepEqual(t.errors,[]);await t.ctx.close();console.log(`PASS ${name}: all 11 public pages at ${width}px`);
      }
      const motion=await setup(browser,{ua:UA.mac,touch:0,width:1280,height:720,reduced:'no-preference'});await motion.page.goto(server.base);await motion.page.locator('[data-story-phase="1"]').click();assert.equal(await motion.page.locator('[data-email-story]').getAttribute('data-phase'),'1');await motion.page.locator('[data-story-replay]').click();await motion.page.locator('#motion-toggle').click();assert.equal(await motion.page.locator('#motion-toggle').getAttribute('aria-pressed'),'true');assert.equal(await motion.page.locator('[data-email-story]').getAttribute('data-phase'),'3');assert.deepEqual(motion.errors,[]);await motion.ctx.close();
      console.log(`PASS ${name}: UI story selection, replay and global motion pause`);
    } finally {await browser.close();}
  }
} finally {await server.close();}
