/** Inspect intermediate scroll frames as well as settled chapter endpoints. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {serve} from './static-server.mjs';
const server=await serve(),browser=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/api.github.com/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto(server.base);
 const geo=await page.locator('.story').evaluate(e=>({top:e.getBoundingClientRect().top+scrollY,height:e.offsetHeight}));
 for(let i=0;i<=60;i++){
  await page.evaluate(y=>scrollTo(0,y),geo.top-100+(i/60)*(geo.height-750));
  await page.waitForTimeout(35);
  const visible=await page.locator('.scene-layer').evaluateAll(els=>els.filter(e=>getComputedStyle(e).visibility==='visible'&&Number(getComputedStyle(e).opacity)>.001).map(e=>({top:e.getBoundingClientRect().top,clipTop:e.parentElement.getBoundingClientRect().top})));
  assert.ok(visible.length<=1,'scroll frame '+i+' overlays two text scenes');
  for(const scene of visible)assert.ok(scene.top>=scene.clipTop-.5,'scroll frame '+i+' clips top of text');
 }
 console.log('Intermediate scroll frames passed: no ghosted text layers or upward text clipping.');
}finally{await browser.close();await server.close()}
