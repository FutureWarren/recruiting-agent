import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MOTION, damp, emailPhase } from '../src/continuum-motion.js';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const html = await read('preview/continuum/index.html');
test('Damping follows elapsed time consistently at 30, 60 and 120 Hz', () => {
  const run = hz => { let x = 0; for (let i = 0; i < hz; i++) x = damp(x, 1, MOTION.follow, 1 / hz); return x; };
  assert.ok(Math.abs(run(30) - run(120)) < 1e-12);
  assert.ok(Math.abs(run(60) - (1 - Math.exp(-1 / MOTION.follow))) < 1e-12);
});
test('Reversing input converges without overshoot', () => {
  let value = .9;
  for (let i = 0; i < 120; i++) { const next = damp(value, .1, MOTION.follow, 1 / 60); assert.ok(next <= value && next >= .1); value = next; }
  assert.ok(value - .1 < .00001);
});
test('Original Hero markup, geometry, scene and signature styling are unchanged', async () => {
  const sha = value => createHash('sha256').update(value).digest('hex');
  assert.equal(sha(html.match(/<header class="hero signature-hero">[\s\S]*?<\/header>/)[0]), 'f3c4b1ef3ac23b5d4706f52082b408f155dcf9d1e19f1bffbe0c766de850ed6d');
  for (const [file, expected] of [
    ['src/continuum-scene.js', '4fea797545977a30b7b552bf6f87ec672d2f1fa336f8f408c532c21d11076c2a'],
    ['src/signature-model.js', '3579bee26cead425210c961655edc027149a1f111b485a6ba8b8c1ff28a367b7'],
    ['preview/signature/signature.css', '69d415d7157ab9252f73d2830226424f97ad50d08ba7022b892e91a661913ef3'],
  ]) assert.equal(sha(await read(file)), expected, file);
});
test('Hero/company strip goes directly to demo, then results and one email example', () => {
  const ids = [...html.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['companies', 'demo', 'numbers', 'profile', 'download']);
  assert.doesNotMatch(html, /class="story"|id="security"|id="recruiting-resources"/);
  assert.equal((html.match(/class="stat motion-reveal"/g) || []).length, 2);
  assert.equal((html.match(/class="email-example"/g) || []).length, 1);
  assert.ok(html.includes('Illustrative example. Your drafts use your own background and research.'));
  for (const href of [...html.matchAll(/href="#([^" ]+)"/g)].map(m => m[1])) assert.ok(html.includes(`id="${href}"`), href);
});
test('Commercial and mobile services are byte-identical to the original prefix', async () => {
  const home = await read('home.js'), cut = home.indexOf('\n(()=>{\n const $=');
  assert.equal(await read('preview/continuum/home-services.js'), home.slice(0, cut) + '\n');
  for (const file of ['home.js', 'mobile.js', 'home.css', 'mobile.css']) assert.equal(await read(file), execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' }));
});
test('Original legal, limitations, mobile handoff and real demo retained', () => {
  for (const text of ['not endorsements or verified offer outcomes', 'not a performance guarantee', 'not confirmed sends', 'Prepared for your review. Not sent.', 'Windows installer is currently unsigned', '/privacy/', '/terms/', '/unsubscribe/', '/media/orbit-demo-hd.mp4', 'id="mobile-handoff-form"', 'id="mobile-handoff-success"']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/<a\b[^>]*\bdata-orbit-download\b/g) || []).length, 3);
  assert.equal((html.match(/id="hero-demo"/g) || []).length, 1);
});
test('Preview guard runs before scripts and prohibits non-read external requests', async () => {
  assert.ok(html.indexOf('/preview/guard.js') < html.indexOf('/preview/continuum/home-services.js'));
  assert.match(await read('preview/guard.js'), /!\['GET', 'HEAD'\]\.includes\(method\)/);
});
test('No wheel hijacking, one RAF owner, time-based rendering and no new runtime dependency', async () => {
  const runtime = await read('src/continuum.js'), scene = await read('src/continuum-scene.js');
  assert.doesNotMatch(runtime, /listen\([^\n]*['"]wheel['"]|addEventListener\(['"]wheel/);
  assert.doesNotMatch(scene, /requestAnimationFrame\(/);
  assert.match(runtime, /passive: true/);
  assert.match(scene, /time \* MOTION.rotation/);
  assert.equal(Object.keys(JSON.parse(await read('package.json')).dependencies).join(','), 'three');
});
test('Accessibility and lifecycle fallbacks are present in both scene and page', async () => {
  const runtime = await read('src/continuum.js'), scene = await read('src/continuum-scene.js');
  for (const text of ['prefers-reduced-motion', 'saveData', 'aria-pressed', 'aria-hidden', 'companyClone.inert', 'visibilitychange', 'pagehide', 'pageshow', 'userPaused', 'IntersectionObserver']) assert.ok(runtime.includes(text), text);
  for (const text of ['webglcontextlost', 'webglcontextrestored', "renderState = 'fallback'", 'renderer.dispose()', 'ro.disconnect()']) assert.ok(scene.includes(text), text);
  assert.match(await read('preview/continuum/continuum.css'), /overflow:clip/);
});
test('Marquee and downstream damping retain pause, focus and native navigation', async () => {
  const runtime = await read('src/continuum.js');
  for (const text of ['companiesVisible && !companyHover && !companyFocus && !drag', 'companySpeed * dt', 'focusin', 'focusout', 'company-prev', 'company-next', 'ArrowLeft', 'ArrowRight']) {
    assert.ok(runtime.includes(text), text);
  }
  assert.match(runtime, /demoEnter = enabled \? damp\(demoEnter, demoTarget, MOTION.follow, dt\)/);
  assert.match(runtime, /emailEnter = enabled \? damp\(emailEnter, emailTarget, MOTION.follow, dt\)/);
  assert.match(runtime, /companyOffset = \(companyOffset \+ companySpeed \* dt\) % companyWidth/);
});
test('Local assets exist, bundle is lazy-split and license is shipped', async () => {
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)].map(m => m[1]);
  for (const asset of new Set(assets)) assert.ok((await stat(new URL('..' + asset + (asset.endsWith('/') ? 'index.html' : ''), import.meta.url))).size > 0, asset);
  const dir = new URL('../preview/continuum/assets/', import.meta.url), files = await readdir(dir);
  assert.ok(files.some(f => f.startsWith('continuum-scene-')));
  assert.ok((await stat(new URL('continuum.js', dir))).size < 15000);
  assert.match(await read('preview/continuum/assets/THREE-LICENSE.txt'), /MIT License/);
});
test('Dark product surfaces and contrasting white closing ring are present', async () => {
  const css = await read('preview/continuum/continuum.css');
  assert.match(html, /class="continuum continuum-dark"/);
  assert.match(html, /data-ambient-scene aria-hidden="true"/);
  for (const [selector, scheme] of [['.email-example', 'dark'], ['.continuum-dark .video-frame', 'dark'], ['.continuum-dark .mobile-handoff-dialog', 'light']]) {
    const rule = css.slice(css.indexOf(selector));
    assert.ok(rule.slice(0, rule.indexOf('}')).includes(`color-scheme:${scheme}`));
    assert.match(rule.slice(0, rule.indexOf('}')), /--muted:/);
  }
  assert.match(html, /class="closing-orbit closing-sculpture" aria-hidden="true"/);
  assert.match(html, /id="ceramic-face"/);
  assert.match(css, /\.continuum-dark \.closing-sculpture \{[^}]*border:0/);
  assert.match(html, /<\/header>\s*<\/div><\/div><section class="company-section/);
  assert.match(css, /\.ambient-orbit \{[^}]*pointer-events:none/);
});
test('Ambient model is lazy, desktop-only animated, capped and included in cleanup', async () => {
  const runtime = await read('src/continuum.js'), scene = await read('src/continuum-scene.js');
  assert.match(runtime, /ambientVisible = ambientStrength > \.01 && desktop.matches/);
  assert.match(runtime, /ambientVisible && !ambientScene && sceneFactory/);
  assert.match(runtime, /ambientTime - ambientLast >= 1 \/ 30/);
  assert.match(runtime, /ambientScene\?\.dispose\(\)/);
  assert.match(scene, /ambient \? 1 :/);
  assert.match(runtime, /if \(enabled && ambientVisible\) ambientTime \+= dt/);
});
test('Short desktop windows keep scroll-linked 3D, without changing the Hero renderer', async () => {
  const runtime = await read('src/continuum.js');
  assert.match(runtime, /const desktop = matchMedia\('\(min-width: 761px\)'\)/);
  assert.match(runtime, /progress: ambientProgress \* 2\.2/);
  assert.match(runtime, /desktop.matches \? \.58 : \.24/);
  assert.match(runtime, /ambientProgress = enabled \? damp/);
});
test('Company wall is faster but still time-based and bounded', () => {
  assert.equal(MOTION.companySpeed, 52);
  assert.ok(MOTION.companySpeed > 22 && MOTION.companySpeed < 70);
});
test('Personalization has three source phases and a complete-draft hold', () => {
  assert.deepEqual([0,3.2,6.4,9.6,15.9,16,19.2].map(emailPhase), [0,1,2,3,3,0,1]);
  assert.equal(emailPhase(-1), 0);
  for (let seconds=0; seconds<160; seconds+=.1) assert.ok(emailPhase(seconds) >= 0 && emailPhase(seconds) <= 3);
});
test('Visual example supports inspection, replay, pause and offscreen suspension', async () => {
  const runtime = await read('src/continuum.js'), css = await read('preview/continuum/continuum.css');
  assert.doesNotMatch(html, /<dl class="personal-details"/);
  assert.equal((html.match(/data-story-phase="/g) || []).length, 3);
  for (const text of ['data-context="0"','data-context="1"','data-context="2"','Replay email personalization animation','Prepared for your review. Not sent.']) assert.ok(html.includes(text), text);
  assert.match(runtime, /enabled && storyVisible && storyPlaying/);
  assert.match(runtime, /storyPlaying = false; showStoryPhase/);
  assert.match(runtime, /storyTime = 0; storyPlaying = true/);
  assert.match(runtime, /io.observe\(story\)/);
  assert.match(css, /\.motion-off \.source-card/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\) \{\s*\.source-card/);
});
