import { MOTION, clamp, damp, emailPhase } from './continuum-motion.js';

const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const body = document.body, hero = $('.signature-hero'), art = $('[data-continuum-scene]');
const ambientArt = $('[data-ambient-scene]');
const video = $('#hero-demo'), strip = $('.company-window'), email = $('.email-example');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// A short desktop browser window is still a desktop. Height must not disable 3D.
const desktop = matchMedia('(min-width: 761px)');
const toggle = $('#motion-toggle'), connection = navigator.connection;
let optedOut = false;
try { optedOut = sessionStorage.getItem('orbit_motion_off') === '1'; } catch {}
let enabled = false, raf = 0, last = 0, time = 0, scene = null, disposed = false;
let heroVisible = true, dirty = true, heroProgress = 0, targetHero = 0;
let px = 0, py = 0, x = 0, y = 0, videoVisible = false, userPaused = false;
let automaticPause = false, demoEnter = 0, demoTarget = 0, emailEnter = 0, emailTarget = 0;
let companiesVisible = false, companyHover = false, companyFocus = false, companySpeed = 0, companyOffset = 0, companyWidth = 0;
let sceneFactory = null, ambientScene = null, ambientTime = 0, ambientLast = -1;
let ambientVisible = false, ambientProgress = 0, ambientTarget = 0, ambientStrength = 0;
const story = $('[data-email-story]'), storyButtons = all('[data-story-phase]');
const captions = ['Your background, woven in', 'A genuine reason to connect', 'A voice that feels like you', 'Ready for your review'];
let storyVisible = false, storyPlaying = true, storyTime = 0, storyPhase = 3;
function showStoryPhase(phase) {
  storyPhase = phase; story.dataset.phase = String(phase);
  storyButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.storyPhase) === phase)));
  $('[data-story-caption]').textContent = captions[phase];
}
const cleanups = [];
function listen(el, event, callback, options) { el?.addEventListener(event, callback, options); cleanups.push(() => el?.removeEventListener(event, callback, options)); }
const schedule = () => { if (!raf && !document.hidden && !disposed) raf = requestAnimationFrame(tick); };
function pauseVideo() { if (!video.paused) { automaticPause = true; video.pause(); } }
function playVideo() { if (enabled && videoVisible && !document.hidden && !userPaused) video.play().catch(() => {}); }
function settings() {
  enabled = !optedOut && !reduced.matches && !connection?.saveData;
  body.classList.toggle('continuum-active', enabled);
  body.classList.toggle('motion-off', !enabled);
  toggle.hidden = false; toggle.textContent = enabled ? 'Pause motion' : 'Motion off';
  toggle.setAttribute('aria-pressed', String(!enabled));
  art.dataset.motion = enabled ? 'running' : 'paused';
  ambientArt.dataset.motion = enabled ? 'running' : 'paused';
  if (!enabled) { px = py = x = y = 0; pauseVideo(); showStoryPhase(3); }
  else playVideo();
  dirty = true; last = 0; schedule();
}
function measure() {
  const rect = hero.getBoundingClientRect();
  targetHero = clamp(-rect.top / Math.max(1, rect.height * .8));
  const demo = $('#demo').getBoundingClientRect();
  demoTarget = clamp((innerHeight - demo.top) / Math.max(1, innerHeight * .9));
  const personal = $('.concise-personal').getBoundingClientRect();
  emailTarget = clamp((innerHeight - personal.top) / Math.max(1, innerHeight * .8));
  companyWidth = $('.company-set').getBoundingClientRect().width;
  const beyondHero = clamp((innerHeight * .75 - rect.bottom) / (innerHeight * .55));
  ambientStrength = beyondHero;
  // Stacked/small screens get a static sculpture; no continuous background GPU loop.
  ambientVisible = ambientStrength > .01 && desktop.matches;
  ambientArt.style.opacity = String(ambientStrength * (desktop.matches ? .58 : .24));
  ambientTarget = clamp((scrollY - hero.offsetHeight) / Math.max(1, document.documentElement.scrollHeight - innerHeight - hero.offsetHeight));
  if (ambientVisible && !ambientScene && sceneFactory) ambientScene = sceneFactory(ambientArt, schedule, { ambient: true });
  $('.reading-progress').style.transform = `scaleX(${clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight))})`;
  dirty = false;
}
function tick(now) {
  raf = 0;
  const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
  if (dirty) measure();
  // The document itself stays native. Only visual followers have inertia.
  heroProgress = enabled ? damp(heroProgress, targetHero, MOTION.follow, dt) : 0;
  demoEnter = enabled ? damp(demoEnter, demoTarget, MOTION.follow, dt) : demoTarget;
  emailEnter = enabled ? damp(emailEnter, emailTarget, MOTION.follow, dt) : emailTarget;
  x = enabled ? damp(x, px, MOTION.pointer, dt) : 0;
  y = enabled ? damp(y, py, MOTION.pointer, dt) : 0;
  ambientProgress = enabled ? damp(ambientProgress, ambientTarget, MOTION.follow, dt) : ambientTarget;
  ambientArt.dataset.scrollProgress = ambientProgress.toFixed(4);
  ambientArt.style.transform = enabled ? `translate3d(0,${-ambientProgress * 45}px,0)` : 'none';
  $('.closing-sculpture').style.transform = enabled ? `perspective(700px) rotateY(${(ambientProgress - .7) * 16}deg) rotateX(${(ambientProgress - .7) * -9}deg)` : 'none';
  if (enabled && heroVisible) time += dt;
  if (enabled && ambientVisible) ambientTime += dt;
  $('.signature-copy').style.transform = enabled ? `translate3d(0,${-heroProgress * 18}px,0)` : 'none';
  const demoFrame = $('#demo .video-frame');
  if (demoFrame) demoFrame.style.transform = enabled && desktop.matches ? `translateY(${(1 - demoEnter) * 30}px) scale(${.94 + .06 * demoEnter})` : 'none';
  email.style.transform = enabled && desktop.matches ? `translateY(${(1 - emailEnter) * 24}px) rotate(${(1 - emailEnter) * 1.2}deg)` : 'none';
  const companyMoving = enabled && companiesVisible && !companyHover && !companyFocus && !drag;
  companySpeed = companyMoving ? damp(companySpeed, MOTION.companySpeed, .4, dt) : 0;
  if (companyMoving && companyWidth > 0) {
    companyOffset = (companyOffset + companySpeed * dt) % companyWidth;
    strip.scrollLeft = companyOffset;
  } else companyOffset = strip.scrollLeft;
  if (scene && heroVisible) scene.render({ time, progress: heroProgress, x, y });
  if (ambientScene && ambientVisible && (!enabled || ambientTime - ambientLast >= 1 / 30)) {
    ambientScene.render({ time: ambientTime, progress: ambientProgress * 2.2, x: 0, y: 0 }); ambientLast = ambientTime;
  }
  const storyMoving = enabled && storyVisible && storyPlaying;
  if (storyMoving) {
    storyTime = (storyTime + dt) % MOTION.storyDuration;
    const phase = emailPhase(storyTime);
    if (phase !== storyPhase) showStoryPhase(phase);
    story.style.setProperty('--story-progress', String(storyTime / MOTION.storyDuration));
    story.style.setProperty('--flow-offset', String(-storyTime * 34));
  }
  story.dataset.playing = String(storyMoving);
  const settling = Math.abs(demoEnter - demoTarget) + Math.abs(emailEnter - emailTarget) + Math.abs(heroProgress - (enabled ? targetHero : 0)) + Math.abs(ambientProgress - ambientTarget) + Math.abs(x - px) + Math.abs(y - py) > .0002;
  if (enabled && (heroVisible && scene?.available || ambientVisible && ambientScene?.available || companyMoving || storyMoving || settling)) schedule();
  else last = 0;
}
listen(toggle, 'click', () => {
  optedOut = !optedOut;
  try { sessionStorage.setItem('orbit_motion_off', optedOut ? '1' : '0'); } catch {}
  settings();
});
storyButtons.forEach(button => listen(button, 'click', () => {
  storyPlaying = false; showStoryPhase(Number(button.dataset.storyPhase)); schedule();
}));
listen($('[data-story-replay]'), 'click', () => {
  storyTime = 0; storyPlaying = true;
  showStoryPhase(enabled ? 0 : 3); schedule();
});
listen(reduced, 'change', settings); listen(desktop, 'change', settings); listen(connection, 'change', settings);
listen(window, 'scroll', () => { dirty = true; schedule(); }, { passive: true });
listen(window, 'resize', () => { dirty = true; schedule(); }, { passive: true });
listen(hero, 'pointermove', event => {
  if (!enabled || event.pointerType !== 'mouse') return;
  const rect = hero.getBoundingClientRect();
  px = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
  py = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5); schedule();
}, { passive: true });
listen(hero, 'pointerleave', () => { px = py = 0; schedule(); });
// One quiet marquee, driven by the same clock as the unchanged Hero. A hidden
// duplicate closes the loop without repeating company names to screen readers.
const companyClone = $('.company-set').cloneNode(true);
companyClone.setAttribute('aria-hidden', 'true'); companyClone.inert = true;
$('.company-track').append(companyClone);
const companyRegion = $('#companies');
listen(companyRegion, 'pointerenter', () => { companyHover = true; schedule(); });
listen(companyRegion, 'pointerleave', () => { companyHover = false; schedule(); });
listen(companyRegion, 'focusin', () => { companyFocus = true; schedule(); });
listen(companyRegion, 'focusout', e => { companyFocus = companyRegion.contains(e.relatedTarget); schedule(); });
listen($('#company-prev'), 'click', () => strip.scrollBy({ left: -280, behavior: enabled ? 'smooth' : 'auto' }));
listen($('#company-next'), 'click', () => strip.scrollBy({ left: 280, behavior: enabled ? 'smooth' : 'auto' }));
listen(strip, 'keydown', e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); strip.scrollBy({ left: e.key === 'ArrowRight' ? 180 : -180, behavior: enabled ? 'smooth' : 'auto' }); } });
let drag = null;
listen(strip, 'pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { drag = { id: e.pointerId, x: e.clientX, left: strip.scrollLeft }; strip.setPointerCapture(e.pointerId); } });
listen(strip, 'pointermove', e => { if (drag?.id === e.pointerId) strip.scrollLeft = drag.left + drag.x - e.clientX; });
const endDrag = e => { if (drag?.id === e.pointerId) { if (strip.hasPointerCapture(e.pointerId)) strip.releasePointerCapture(e.pointerId); drag = null; schedule(); } };
listen(strip, 'pointerup', endDrag); listen(strip, 'pointercancel', endDrag); listen(strip, 'lostpointercapture', () => { drag = null; });

listen(video, 'loadedmetadata', () => { if (Number.isFinite(video.duration)) $('#video-duration').textContent = `${Math.round(video.duration)}s · 1080p`; dirty = true; schedule(); });
listen(video, 'error', () => { $('#video-fallback').hidden = false; });
listen(video, 'pause', () => { if (automaticPause) automaticPause = false; else if (videoVisible && !document.hidden) userPaused = true; });
listen(video, 'play', () => { userPaused = false; });
all('a[href="#demo"]').forEach(link => listen(link, 'click', e => {
  if (link.getAttribute('href') !== '#demo') return;
  e.preventDefault(); video.closest('.video-frame').scrollIntoView({ block: 'center', behavior: 'auto' });
  userPaused = false; video.play().catch(() => {});
}));
const io = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.target === art) { heroVisible = entry.isIntersecting; dirty = true; schedule(); }
  else if (entry.target === strip) { companiesVisible = entry.isIntersecting; schedule(); }
  else if (entry.target === story) { storyVisible = entry.isIntersecting && entry.intersectionRatio >= .1; schedule(); }
  else if (entry.target === video) { videoVisible = entry.isIntersecting && entry.intersectionRatio >= .35; if (videoVisible) playVideo(); else pauseVideo(); }
  else if (entry.isIntersecting) { entry.target.classList.add('seen'); io.unobserve(entry.target); }
}), { threshold: [0, .1, .35] });
io.observe(art); io.observe(video); io.observe(strip); io.observe(story); all('.motion-reveal').forEach(el => io.observe(el));
listen(document, 'visibilitychange', () => {
  cancelAnimationFrame(raf); raf = 0; last = 0;
  if (document.hidden) pauseVideo(); else { dirty = true; schedule(); playVideo(); }
});
listen(window, 'pagehide', event => {
  cancelAnimationFrame(raf); raf = 0; last = 0;
  if (event.persisted) return;
  disposed = true; scene?.dispose(); ambientScene?.dispose(); io.disconnect(); cleanups.forEach(fn => fn());
});
listen(window, 'pageshow', event => { if (event.persisted) { dirty = true; settings(); } });
body.classList.add('continuum-ready'); settings();
import('./continuum-scene.js').then(({ createScene }) => {
  if (disposed) return;
  sceneFactory = createScene; scene = createScene(art, schedule); dirty = true; schedule();
}).catch(() => { art.dataset.renderState = 'fallback'; });
