import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Face Match is independently routed and built',()=>{
  const h=read('face-match/index.html'), b=read('scripts/build-continuum-pages.mjs'),m=read('sitemap.xml');
  assert.match(h,/<title>Face Match/);assert.match(h,/\/resume-score\//);assert.match(b,/'face-match'/);
  assert.match(m,/\/face-match\/<\/loc>/);assert.match(h,/id="consent"/);
});
test('Camera privacy, actual API gate and safe rendering',()=>{
  const j=read('face-match/face-match.js'),c=read('face-match/face-match.css');
  assert.match(j,/getUserMedia/);assert.match(j,/stopCamera/);assert.match(j,/consent:true/);
  assert.match(j,/FaceDetector.createFromOptions/);
  assert.match(j,/\/api\/face-match\/config/);
  assert.match(j,/serverReady/);
  assert.match(j,/\/api\/face-match\/analyze/);assert.match(j,/if\(!valid\(data\)\)/);
  assert.doesNotMatch(j,/\.innerHTML\s*=/);
  assert.doesNotMatch(j,/localStorage\.setItem/);
  assert.match(c,/prefers-reduced-motion:reduce/);assert.match(c,/@media\(max-width:760px\)/);
});
test('Face Match privacy notice discloses photo processing',()=>{
  const p=read('privacy/index.html');
  assert.match(p,/Face Match/);
  assert.match(p,/DashScope\/Qwen/);
  assert.match(p,/provider-side retention/);
});

test('Face Match only shows custom upload action and explains transient server errors',()=>{
  const html=read('face-match/index.html');
  const css=read('face-match/face-match.css');
  const js=read('face-match/face-match.js');
  assert.match(html,/id="photo-input" class="fm-visually-hidden"/);
  assert.match(css,/\.fm-visually-hidden\{/);
  assert.match(js,/controller\.abort\(\),45000/);
  assert.match(js,/Our AI couldn/);
  assert.doesNotMatch(js,/Analysis is not available yet\. Please try again later/);
});

test('Portrait-vibe v2 renders real editorial brand logos and positive tags',()=>{
 const h=read('face-match/index.html');
 const js=read('face-match/face-match.js');
 const css=read('face-match/face-match.css');
 assert.match(h,/id="brand-match"/);
 assert.match(h,/id="brand-logo"/);
 assert.match(h,/id="brand-alternates"/);
 assert.match(h,/id="result-subtitle"/);
 assert.match(js,/APPROVED_BRAND_DOMAINS/);
 assert.match(js,/goldmansachs\.com/);
 assert.match(js,/morganstanley\.com/);
 assert.match(js,/figma\.com/);
 assert.match(js,/google\.com/);
 assert.match(js,/officialFaviconUrl/);
 assert.match(js,/renderBrandVibe/);
 assert.match(js,/data\.version==='photo-vibe-v2'/);
 assert.match(css,/\.fm-brand-match/);
 assert.doesNotMatch(js,/short-term request limit/);
 assert.match(h,/not your outfit/);
});
