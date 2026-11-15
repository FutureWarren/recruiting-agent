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
