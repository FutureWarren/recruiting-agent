'use strict';
/**
 * Free Orbit tools -> first networking task handoff.
 * Source, goal and (optional) previously submitted email stay in this browser tab
 * for 15 minutes. Nothing is posted to handoff until the user submits /start/.
 * Anonymous funnel telemetry contains only allowlisted stage, AB arm and UUID.
 */
(function () {
  const API = 'https://backend-production-2b40.up.railway.app';
  const KEY = 'orbit_networking_intent_v1';
  const SESSION_KEY = 'orbit_labs_tab_session_v1';
  const STAGES = new Set(['result_viewed', 'networking_cta_viewed', 'networking_cta_clicked', 'share_clicked']);
  const SOURCES = new Set(['resume_evaluation', 'face_match']);
  const LIMIT_MS = 15 * 60 * 1000;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function clean(value, length = 90) {
    return typeof value === 'string'
      ? value.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, length)
      : '';
  }
  function sessionId() {
    try {
      let value = sessionStorage.getItem(SESSION_KEY) || '';
      if (!/^[0-9a-f-]{36}$/i.test(value)) {
        value = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, value);
      }
      return value;
    } catch { return ''; }
  }
  function variant(tool) {
    if (!['resume-evaluation', 'face-match'].includes(tool)) return 'none';
    const key = 'orbit_networking_variant_v1_' + tool;
    try {
      let value = sessionStorage.getItem(key);
      if (value !== 'a' && value !== 'b') {
        value = crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? 'a' : 'b';
        sessionStorage.setItem(key, value);
      }
      return value;
    } catch { return 'a'; }
  }
  function track(tool, stage, arm) {
    if (!['resume-evaluation', 'face-match'].includes(tool) || !STAGES.has(stage)) return;
    try {
      if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
      const id = sessionId();
      if (!id) return;
      void fetch(API + '/api/public-tools/event', {
        method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool, sessionId: id, event: stage,
          variant: ['a','b'].includes(arm) ? arm : 'none' })
      }).catch(() => {});
    } catch { /* Telemetry must never block the task. */ }
  }
  function prepare(options) {
    const source = SOURCES.has(options.source) ? options.source : '';
    if (!source) return false;
    const company = clean(options.company, 75);
    const industry = clean(options.industry, 50);
    const preferredEmail = clean(options.email, 254).toLowerCase();
    const email = preferredEmail.length <= 254 && EMAIL.test(preferredEmail) ? preferredEmail : '';
    const goal = source === 'resume_evaluation' && company
      ? 'Find relevant alumni at ' + company
      : source === 'face_match' && industry
        ? 'Find alumni in ' + industry + ' and prepare a networking introduction'
        : 'Find relevant alumni and prepare personalized networking introductions';
    const detail = 'Research relevant people, find professional contact information when available, ' +
      'and prepare thoughtful outreach drafts for my review. Never send messages without my approval.';
    const payload = { source, company, industry, email, goal, detail, createdAt: Date.now() };
    try { sessionStorage.setItem(KEY, JSON.stringify(payload)); return true; }
    catch { return false; }
  }
  function read() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!SOURCES.has(value?.source) || !Number.isFinite(value?.createdAt) ||
        Date.now() - value.createdAt < 0 || Date.now() - value.createdAt > LIMIT_MS) {
        sessionStorage.removeItem(KEY); return null;
      }
      // User-controlled browser storage is untrusted; reconstruct bounded fields.
      const company = clean(value.company, 75);
      const industry = clean(value.industry, 50);
      const email = clean(value.email, 254).toLowerCase();
      const safeEmail = EMAIL.test(email) ? email : '';
      const source = value.source;
      const goal = source === 'resume_evaluation' && company
        ? 'Find relevant alumni at ' + company
        : source === 'face_match' && industry
          ? 'Find alumni in ' + industry + ' and prepare a networking introduction'
          : 'Find relevant alumni and prepare personalized networking introductions';
      const detail = 'Research relevant people, find professional contact information when available, ' +
        'and prepare thoughtful outreach drafts for my review. Never send messages without my approval.';
      return { source, company, industry, email: safeEmail, goal: goal.slice(0, 120), detail };
    } catch { return null; }
  }
  function clear() { try { sessionStorage.removeItem(KEY); } catch {} }
  function href(source, arm) {
    if (!SOURCES.has(source)) return '/start/';
    const params = new URLSearchParams({
      source, utm_source: source, utm_medium: 'free_tool',
      utm_campaign: 'networking_activation', utm_content: arm === 'b' ? 'b' : 'a'
    });
    return '/start/?' + params.toString();
  }
  window.OrbitNetworkingBridge = Object.freeze({ variant, track, prepare, read, clear, href });
})();
