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
  full.href = video.querySelector('source').getAttribute('src');
  full.textContent = 'Full screen ↗';
  full.setAttribute('aria-label', 'Watch the real Orbit demo full screen');
  caption.append(label, full);
  frame.after(caption);
  full.addEventListener('click', async event => {
    if (!video.requestFullscreen && !video.webkitEnterFullscreen) return;
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
  backupButton.textContent = 'Or copy desktop link';
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
      backupStatus.textContent = 'Copied. Open it on your computer.';
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
      backupStatus.textContent = 'Select and copy this link. Open it on your computer.';
    }
  });

  // Real first-paint open: no timer, scroll threshold, synthetic CTA click or network wait.
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  document.body.classList.add('handoff-modal-open');
  root.classList.remove('orbit-mobile-pending');
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
    document.getElementById('dl-btn').textContent = 'Get Orbit on my computer →';
    document.getElementById('dl-meta').textContent = 'Mac (M1+) · Windows x64 beta · 100 free credits';
  }, {once:true});
})();
