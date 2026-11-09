'use strict';
/* Composition only. Existing home.js retains email delivery, attribution and installers. */
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('orbit-mobile')) return;
  const modal = document.getElementById('mobile-handoff-modal');
  const dialog = modal?.querySelector('[role="dialog"]');
  const form = document.getElementById('mobile-handoff-form');
  const email = document.getElementById('mobile-handoff-email');
  const copy = document.querySelector('.hero-copy');
  const video = document.getElementById('hero-demo');
  if (!modal || !dialog || !form || !email || !copy || !video) {
    root.classList.remove('orbit-mobile', 'orbit-mobile-pending');
    return;
  }

  // Move the actual existing player, not a duplicate, cropped fake UI or a new video.
  const frame = video.closest('.video-frame');
  copy.insertBefore(frame, copy.querySelector('.actions'));
  copy.querySelector(':scope > p').textContent = 'Find people. Find emails. Draft outreach.';
  const caption = document.createElement('div');
  caption.className = 'mobile-video-caption';
  const label = document.createElement('span');
  label.textContent = 'Real Orbit demo · You stay in control.';
  const full = document.createElement('a');
  full.href = '/media/orbit-demo-light-20261108.mp4';
  full.textContent = 'Full screen ↗';
  full.setAttribute('aria-label', 'Watch Orbit demo full screen');
  caption.append(label, full);
  frame.after(caption);
  full.addEventListener('click', async event => {
    const fullscreen = video.requestFullscreen || video.webkitEnterFullscreen;
    if (!fullscreen) return;
    event.preventDefault();
    try {
      if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else await video.requestFullscreen();
      await video.play();
    } catch (_) { window.location.assign(full.href); }
  });
  const requirements = document.createElement('details');
  requirements.className = 'mobile-device-details';
  const summary = document.createElement('summary');
  summary.textContent = 'Device requirements';
  const requirementCopy = document.createElement('p');
  requirementCopy.textContent = document.querySelector('.desktop-requirement').textContent;
  requirements.append(summary, requirementCopy);
  copy.append(requirements);
  root.classList.add('mobile-ready');

  // Native iOS Safari can block autoplay in Low Power Mode even for muted video.
  // Show a first-party tap-to-play fallback only if the browser refuses playback.
  const videoFallback = document.createElement('button');
  videoFallback.type = 'button';
  videoFallback.id = 'mobile-demo-play-fallback';
  videoFallback.className = 'mobile-demo-play-fallback';
  videoFallback.textContent = '▶ Play Orbit demo';
  videoFallback.setAttribute('aria-label', 'Play the 20-second Orbit demo');
  videoFallback.hidden = true;
  frame.append(videoFallback);
  const tryUserPlayback = () => {
    video.muted = true;
    video.playsInline = true;
    const result = video.play();
    if (result?.catch) void result.catch(() => { videoFallback.hidden = false; });
  };
  videoFallback.addEventListener('click', tryUserPlayback);
  video.addEventListener('orbit:autoplay-blocked', () => {
    if (video.paused && !document.hidden) videoFallback.hidden = false;
  });
  video.addEventListener('play', () => { videoFallback.hidden = true; });

  // The email link is captured first; the optional task builder remains below the demo.
  const composer = document.createElement('section');
  composer.id = 'orbit-mobile-task';
  composer.className = 'orbit-mobile-task';
  composer.setAttribute('aria-labelledby', 'orbit-mobile-task-title');
  composer.innerHTML = [
    '<div class="orbit-task-eyebrow">01 / PREPARE YOUR FIRST TASK</div>',
    '<h2 id="orbit-mobile-task-title">Start with alumni who get your path.</h2>',
    '<p>Tell Orbit where you study and what field interests you. We will prepare the task here, then run it on your computer.</p>',
    '<form id="orbit-mobile-task-form" novalidate>',
    '<div class="orbit-task-fields">',
    '<label for="orbit-task-school">Your university<input id="orbit-task-school" name="school" type="text" placeholder="e.g. NYU" autocomplete="organization" maxlength="55" required></label>',
    '<label for="orbit-task-industry">Target industry<select id="orbit-task-industry" name="industry"><option value="Investment Banking">Investment Banking</option><option value="Consulting">Consulting</option><option value="Private Equity">Private Equity</option><option value="Technology">Technology</option><option value="Asset Management">Asset Management</option><option value="Marketing">Marketing</option><option value="Other professional fields">Other</option></select></label>',
    '</div>',
    '<p class="orbit-task-error" id="orbit-task-error" role="alert" hidden></p>',
    '<button type="submit" class="orbit-task-submit">Prepare my networking task <span aria-hidden="true">→</span></button>',
    '</form>',
    '<p class="orbit-task-fine">No LinkedIn or Gmail password on this website. You will review drafts before sending.</p>'
  ].join('');
  caption.after(composer);
  const taskForm = composer.querySelector('#orbit-mobile-task-form');
  const school = composer.querySelector('#orbit-task-school');
  const industry = composer.querySelector('#orbit-task-industry');
  const taskError = composer.querySelector('#orbit-task-error');
  let preparedTask = null;
  const markedStages = new Set();
  const recordStage = stage => {
    if (markedStages.has(stage) || typeof handoffApi !== 'function') return;
    markedStages.add(stage);
    void handoffApi('/api/handoff/event', {
      visitorId: handoffVisitor(), stage, ...handoffAttribution()
    }).catch(() => {});
  };
  window.orbitMobileTask = () => preparedTask ? {...preparedTask} : null;
  const invalidate = () => { preparedTask = null; taskError.hidden = true; recordStage('task_config_started_v3'); };
  school.addEventListener('input', invalidate);
  industry.addEventListener('change', invalidate);
  // Track a genuine play event; native HTML5 loop playback is observable.
  video.addEventListener('play', () => recordStage('demo_played_v3'), {once:true});
  full.addEventListener('click', () => recordStage('demo_opened_v3'), {once:true});
  taskForm.addEventListener('submit', event => {
    event.preventDefault();
    const university = school.value.trim().replace(/\s+/g, ' ').slice(0, 55);
    if (!university) {
      taskError.textContent = 'Add your university so Orbit knows which alumni to look for.';
      taskError.hidden = false;
      school.focus();
      return;
    }
    taskError.hidden = true;
    const field = industry.value;
    preparedTask = {
      goal: 'Connect with ' + university + ' alumni in ' + field,
      detail: 'Find up to 5 relevant alumni on LinkedIn, research their professional backgrounds, avoid duplicate contacts, look for available work emails, and prepare personalized networking email drafts for my review. Do not send messages without my approval.'
    };
    const title = document.getElementById('mobile-handoff-title');
    const intro = document.querySelector('#mobile-handoff-form-state > p');
    title.textContent = 'Your first task is ready.';
    intro.textContent = 'Email this prepared task to yourself, then open it on your Mac or Windows computer.';
    let summary = document.getElementById('mobile-prepared-task');
    if (!summary) {
      summary = document.createElement('p');
      summary.id = 'mobile-prepared-task';
      summary.className = 'mobile-prepared-task';
      intro.after(summary);
    }
    summary.textContent = preparedTask.goal + '. ' + preparedTask.detail;
    // This is intentionally an example, NOT a fabricated real AI result.
    // Users still need the desktop app to discover verified people and produce drafts.
    let preview = document.getElementById('mobile-illustrative-email');
    if (!preview) {
      preview = document.createElement('details');
      preview.id = 'mobile-illustrative-email';
      preview.className = 'mobile-illustrative-email';
      const toggle = document.createElement('summary');
      toggle.textContent = 'Preview an example email (illustrative only)';
      const message = document.createElement('p');
      message.className = 'mobile-example-message';
      preview.append(toggle, message);
      summary.after(preview);
    }
    preview.querySelector('.mobile-example-message').textContent =
      'Subject: Fellow ' + university + ' student exploring ' + field +
      '\n\nHi [Name], I’m a ' + university + ' student interested in ' + field +
      '. I would love to learn about your experience and career path. Would you be open to a brief conversation?\n\n' +
      'Example only: no person has been researched, and no email has been sent.';
    recordStage('task_previewed_v3');
    window.dispatchEvent(new Event('orbit:open-handoff'));
  });
  // Existing download links remain present for no-JS/desktop users. On phones,
  // each call-to-action leads to the composer instead of a forced email modal.
  document.querySelectorAll('[data-orbit-download]').forEach(button => {
    button.addEventListener('click', event => {
      if (button.dataset.downloadState !== 'handoff') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      recordStage('cta_clicked_v2');
      if (preparedTask) {
        window.dispatchEvent(new Event('orbit:open-handoff'));
      } else {
        composer.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
      }
    }, {capture:true});
  });
  // Mobile-safe native playback: muted autoplay + playsinline + loop, no branding overlay.
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';


  const brand = document.createElement('div');
  brand.className = 'mobile-sheet-brand';
  const mark = document.createElement('span');
  mark.className = 'orbit-mark';
  mark.setAttribute('aria-hidden', 'true');
  brand.append(mark, 'Orbit');
  dialog.insertBefore(brand, document.getElementById('mobile-handoff-form-state'));
  document.querySelector('#mobile-handoff-form-state > p').textContent = 'Email yourself the desktop download link.';
  document.querySelector('.mobile-handoff-fine').innerHTML = 'Any email. No signup here. <a href="/privacy/">Privacy</a>';

  // A genuine no-email alternative. Only allowlisted marketing parameters are copied.
  const backupButton = document.createElement('button');
  backupButton.id = 'mobile-copy-before';
  backupButton.type = 'button';
  backupButton.className = 'mobile-copy-before';
  backupButton.textContent = 'Copy generic site link (task not saved)';
  const backupStatus = document.createElement('p');
  backupStatus.className = 'mobile-copy-status';
  backupStatus.setAttribute('role', 'status');
  document.getElementById('mobile-handoff-form-state').append(backupButton, backupStatus);
  const genericLink = () => {
    const url = new URL('https://orbit-reaches.com/');
    const query = new URLSearchParams(location.search);
    for (const key of ['source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
      if (query.get(key)) url.searchParams.set(key, query.get(key).slice(0, 120));
    }
    if (!url.searchParams.get('source')) url.searchParams.set('source', 'mobile_share');
    return url.href;
  };
  let intentRecorded = false;
  const recordIntent = () => {
    if (intentRecorded || typeof handoffApi !== 'function') return;
    intentRecorded = true;
    void handoffApi('/api/handoff/event', {
      visitorId: handoffVisitor(), stage: 'cta_clicked_v2', ...handoffAttribution()
    }).catch(() => {});
  };
  form.addEventListener('submit', () => {
    if (/^\S+@\S+\.\S+$/.test(email.value.trim())) recordIntent();
  });
  backupButton.addEventListener('click', async () => {
    recordIntent();
    const url = genericLink();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      backupStatus.textContent = 'Copied a generic website link. To save your chosen task, use email above.';
    } catch (_) {
      let field = document.getElementById('mobile-copy-backup');
      if (!field) {
        field = document.createElement('input');
        field.id = 'mobile-copy-backup';
        field.className = 'mobile-copy-backup';
        field.type = 'text'; field.readOnly = true;
        field.setAttribute('aria-label', 'Desktop link to copy');
        backupButton.after(field);
      }
      field.value = url; field.focus(); field.select();
      backupStatus.textContent = 'Copy the generic link. Only the email handoff saves your chosen task.';
    }
  });

  // Phone QR visitors see the one-field email handoff sheet immediately.
  // The sheet is dismissible and never focuses the input/opens the keyboard
  // until the visitor explicitly taps it; displaying it is NOT a form start.
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  document.body.classList.add('handoff-modal-open');
  root.classList.remove('orbit-mobile-pending');
  dialog.querySelector('.mobile-handoff-close')?.addEventListener('click', tryUserPlayback);
  dialog.tabIndex = -1;
  let wasOpen = false;
  let returnFocus = null;
  const background = [...document.querySelectorAll('main, .nav-wrap, body > footer, .skip')];
  const previousInert = new Map(background.map(el => [el, el.inert]));
  const syncDialog = () => {
    // Guard the legacy 220ms close callback when a visitor immediately reopens.
    if (modal.hidden && modal.classList.contains('is-open')) {
      modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    }
    const open = !modal.hidden && modal.classList.contains('is-open');
    if (open === wasOpen) return;
    wasOpen = open;
    background.forEach(el => { el.inert = open || previousInert.get(el); });
    if (open) {
      returnFocus = document.activeElement;
      // Focus the dialog, never the email field: do not raise the keyboard or fake form starts.
      dialog.focus({preventScroll:true});
    } else {
      const target = returnFocus instanceof HTMLElement && returnFocus !== document.body
        ? returnFocus : document.getElementById('nav-download');
      target?.focus({preventScroll:true});
    }
  };
  new MutationObserver(syncDialog).observe(modal, {attributes:true,attributeFilter:['hidden','class']});
  syncDialog();
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button, input, a[href], [tabindex="0"]')]
      .filter(el => !el.disabled && el.getClientRects().length > 0);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items.at(-1), active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (active === last || active === dialog)) {
      event.preventDefault(); first.focus();
    }
  });
  const fitKeyboard = () => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    modal.style.setProperty('--orbit-vv-height', viewport.height + 'px');
    modal.style.setProperty('--orbit-vv-top', viewport.offsetTop + 'px');
  };
  window.visualViewport?.addEventListener('resize', fitKeyboard, {passive:true});
  window.visualViewport?.addEventListener('scroll', fitKeyboard, {passive:true});
  fitKeyboard();
  // home.js initializes the existing device routing first; only change phone labels afterward.
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-orbit-download]').forEach(button => { if (button.dataset.downloadState === 'handoff') button.textContent = 'Prepare my task →'; });
    document.getElementById('dl-meta').textContent = 'Mac (M1+) · Windows x64 beta · 100 free credits';
  }, {once:true});
})();
