/**
 * Mobile must be a complete scrollable site, not a hero-only landing screen.
 * All external handoff requests are mocked, including checks against the live site.
 */
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright-core';
import {serve, root} from './static-server.mjs';
const live = process.argv.includes('--live');
const server = live ? null : await serve();
const base = live ? 'https://orbit-reaches.com' : server.base;
const artifacts = join(root, 'artifacts');
mkdirSync(artifacts, {recursive:true});
const sections = ['companies','how','numbers','profile','security','download'];
const ua = {
  phone:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  android:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
  ipad:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
};
const report = [];
try {
  for (const [name, engine] of (live ? [['chromium',chromium]] : [['chromium',chromium],['webkit',webkit]])) {
    const browser = await engine.launch(name === 'chromium' ? {
      ...(process.env.CHROMIUM ? {executablePath:process.env.CHROMIUM} : {}),args:['--no-sandbox']
    } : {});
    try {
      for (const [device,width,height,userAgent] of [
        ['iphone',390,844,ua.phone],['small-phone',320,568,ua.android],['tablet',1024,768,ua.ipad]
      ]) {
        const context = await browser.newContext({
          viewport:{width,height},userAgent,isMobile:true,hasTouch:true,reducedMotion:'reduce'
        });
        context.setDefaultTimeout(12000);
        context.setDefaultNavigationTimeout(20000);
        await context.route('https://backend-production-2b40.up.railway.app/**',
          r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
        await context.route('https://api.github.com/**',r=>r.fulfill({status:503,body:'{}'}));
        const page = await context.newPage(), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        try {
          await page.goto(base+'/?source=internal_test&utm_campaign=mobile_complete_page',{waitUntil:'domcontentloaded'});
          assert.equal(await page.locator('#mobile-handoff-email').isVisible(),true,'immediate email sheet retained');
          assert.equal(await page.locator('#mobile-handoff-form input[type=email]').count(),1,'still requires email only');assert.equal(await page.locator('#mobile-news-consent').isChecked(),false,'newsletter consent remains optional');
          await page.locator('.mobile-handoff-close').click();
          await page.waitForFunction(()=>document.getElementById('mobile-handoff-modal').hidden);
          assert.equal(await page.locator('main').evaluate(e=>e.inert),false,'closing the sheet unlocks the page');
          assert.equal(await page.locator('#hero-demo').count(),1,'do not duplicate the existing video');
          assert.equal(await page.locator('#hero-demo').evaluate(e=>!!e.closest('.hero-copy')),true);
          const hero = await page.locator('#hero-demo').boundingBox();
          assert.ok(hero.y < height && hero.y + hero.height <= height,'real demo remains in the first screen');
          const seen=[];
          for (const id of sections) {
            const section=page.locator('#'+id);
            assert.equal(await section.isVisible(),true,device+': missing #'+id);
            await section.scrollIntoViewIfNeeded();
            const geometry=await section.evaluate(e=>{
              const r=e.getBoundingClientRect();
              return {id:e.id,height:r.height,top:r.top,bottom:r.bottom,scrollY,
                inViewport:r.top<innerHeight&&r.bottom>0,
                overflow:document.documentElement.scrollWidth>innerWidth};
            });
            assert.ok(geometry.height>20&&geometry.inViewport,'section is readable in the page flow: '+id);
            assert.equal(geometry.overflow,false,device+': horizontal overflow at #'+id);
            seen.push(geometry);
          }
          const scroll=await page.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight,view:innerHeight}));
          assert.ok(scroll.height>scroll.view*2,'mobile content must extend past the hero');
          assert.ok(scroll.y>scroll.view,'visitor can scroll to the bottom content');
          const link=page.locator('#dl-btn-final');
          assert.equal(await link.isVisible(),true);
          assert.equal(await link.getAttribute('href'),'#mobile-handoff-modal','bottom CTA keeps phone-to-desktop handoff');
          await link.click();
          await page.locator('#mobile-handoff-email').waitFor({state:'visible'});
          await page.locator('.mobile-handoff-close').click();
          await page.waitForFunction(()=>document.getElementById('mobile-handoff-modal').hidden);
          await page.locator('#security a[href="/privacy/"]').scrollIntoViewIfNeeded();
          assert.equal(await page.locator('#security a[href="/privacy/"]').isVisible(),true);
          if(width<760) for(let i=0;i<4;i++) {
            await page.locator('.story-step').nth(i).click();
            await page.waitForFunction(n=>document.querySelector('.story-stage').dataset.step===String(n),i);
            assert.equal(await page.locator('.scene-layer[aria-hidden="false"]').count(),1);
            const fits=await page.locator('.scene-layer[aria-hidden="false"]').evaluate(el=>{
              const outer=el.closest('.story-scene').getBoundingClientRect();
              return [...el.children].every(child=>{
                const r=child.getBoundingClientRect();
                return r.bottom<=outer.bottom+1&&r.right<=outer.right+1;
              });
            });
            assert.equal(fits,true,'workflow chapter '+i+' must not crop its text on '+device);
          }
          await page.evaluate(()=>scrollTo(0,0));
          assert.deepEqual(errors,[]);
          const suffix=(live?'live-':'')+name+'-'+device;
          await page.screenshot({path:join(artifacts,'mobile-complete-'+suffix+'.png'),fullPage:true,animations:'disabled'});
          report.push({engine:name,device,sections:seen,scroll,errors});
          console.log('PASS mobile complete page '+suffix+': all six sections, scrolling, first-screen demo, immediate email, bottom CTA.');
        } catch(error) {
          await page.screenshot({path:join(artifacts,'mobile-complete-failure-'+name+'-'+device+'.png'),fullPage:true}).catch(()=>{});
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally {
  writeFileSync(join(artifacts,(live?'live-':'')+'mobile-complete-results.json'),JSON.stringify(report,null,2));
  await server?.close();
}
