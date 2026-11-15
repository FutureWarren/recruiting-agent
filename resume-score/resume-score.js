'use strict';

// Public, no-login funnel. Never upload until the visitor submits a résumé.
// Scores are not generated or shown until the server has actually analyzed it.
const API = 'https://backend-production-2b40.up.railway.app';
const byId = id => document.getElementById(id);
const stages = ['upload-stage', 'loading-stage', 'gate-stage', 'result-stage'];
const scoreDimensions = [
  ['experience', 'Relevant experience', 30],
  ['impact', 'Quantified impact', 20],
  ['relevance', 'Role relevance', 20],
  ['clarity', 'Clarity and structure', 15],
  ['skills', 'Evidence of skills', 10],
  ['ats', 'ATS readability', 5]
];
const fileInput = byId('resume-file');
const button = byId('analyze-button');
const fileName = byId('file-name');
const uploadError = byId('upload-error');
const gateError = byId('unlock-error');
let ready = false, reportToken = '', report = null, captchaToken = '', captchaSiteKey = '';

function show(stage) {
  for (const id of stages) byId(id).hidden = id !== stage;
  byId(stage).scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function fail(box, message) { box.textContent = message; box.hidden = false; }
function clear(box) { box.textContent = ''; box.hidden = true; }
async function api(path, options) {
  const response = await fetch(API + path, { ...options, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Orbit could not complete that request.');
  return data;
}
function validateFile(file) {
  if (!file) return 'Choose a PDF or DOCX résumé first.';
  if (!/\.(pdf|docx)$/i.test(file.name)) return 'Only PDF and DOCX resumes are supported.';
  if (file.size < 20 || file.size > 2 * 1024 * 1024) return 'Your résumé must be smaller than 2 MB.';
  return '';
}
function reflectFile() {
  const file = fileInput.files?.[0];
  const error = file ? validateFile(file) : '';
  fileName.textContent = file ? file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB' : 'or drag a file here · max 2 MB';
  clear(uploadError);
  if (error) fail(uploadError, error);
  button.disabled = !ready || !file || Boolean(error);
}
function loadCaptcha(siteKey) {
  if (!siteKey) return;
  captchaSiteKey = siteKey;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => {
    if (!window.turnstile) { fail(uploadError, 'Verification is unavailable. Please reload.'); return; }
    window.turnstile.render('#captcha', {
      sitekey: siteKey,
      callback(token) { captchaToken = token; },
      'expired-callback'() { captchaToken = ''; },
      'error-callback'() { captchaToken = ''; }
    });
  };
  script.onerror = () => fail(uploadError, 'Verification could not load. Please reload.');
  document.head.append(script);
}
async function initialize() {
  try {
    const config = await api('/api/resume-score/config');
    ready = config.ready === true;
    if (ready) loadCaptcha(config.captchaSiteKey || '');
    if (!ready) fail(uploadError, 'Resume Intelligence is being prepared. Please check back soon.');
  } catch {
    fail(uploadError, 'Could not connect to Resume Intelligence. Please check back soon.');
  }
  reflectFile();
  if (!ready) fail(uploadError, 'Resume Intelligence is not available yet.');
}
fileInput.addEventListener('change', reflectFile);
for (const eventName of ['dragenter', 'dragover']) {
  byId('resume-drop').addEventListener(eventName, event => {
    event.preventDefault(); byId('resume-drop').classList.add('is-dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  byId('resume-drop').addEventListener(eventName, event => {
    event.preventDefault(); byId('resume-drop').classList.remove('is-dragging');
  });
}
byId('resume-drop').addEventListener('drop', event => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  reflectFile();
});
async function base64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let pos = 0; pos < bytes.length; pos += 8192) {
    binary += String.fromCharCode(...bytes.subarray(pos, pos + 8192));
  }
  return btoa(binary);
}
byId('resume-form').addEventListener('submit', async event => {
  event.preventDefault();
  clear(uploadError);
  const file = fileInput.files?.[0];
  const error = validateFile(file);
  if (error) { fail(uploadError, error); return; }
  if (!ready) { fail(uploadError, 'Resume Intelligence is not available yet.'); return; }
  if (captchaSiteKey && !captchaToken) { fail(uploadError, 'Complete the verification first.'); return; }
  button.disabled = true;
  show('loading-stage');
  try {
    const result = await api('/api/resume-score/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: file.name, fileBase64: await base64(file), captchaToken })
    });
    if (!result.ready || !result.token) throw new Error('We could not complete this analysis.');
    reportToken = result.token;
    show('gate-stage');
    byId('unlock-email').focus();
  } catch (err) {
    show('upload-stage');
    reflectFile();
    fail(uploadError, err.message || 'Something went wrong. Try again.');
    if (window.turnstile) { window.turnstile.reset(); captchaToken = ''; }
  }
  finally { if (!reportToken) button.disabled = false; }
});
byId('unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  clear(gateError);
  if (!reportToken) { fail(gateError, 'This analysis has expired. Upload your résumé again.'); return; }
  const email = byId('unlock-email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    fail(gateError, 'Please enter a valid email address.'); return;
  }
  const unlockButton = byId('unlock-button');
  unlockButton.disabled = true;
  try {
    const data = await api('/api/resume-score/unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: reportToken, email })
    });
    report = data.report;
    render(report);
    show('result-stage');
    // An email used to unlock a report is not marketing permission.
    // Only an explicit, unchecked-by-default opt-in can create a subscription.
    if (byId('marketing-consent').checked) {
      try {
        await api('/api/marketing/subscribe', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, consent: true, frequency: 'weekly' })
        });
        byId('result-status').textContent = 'Check your inbox if you chose to confirm optional Orbit updates.';
      } catch {
        byId('result-status').textContent = 'Your report is unlocked. The optional email subscription could not start.';
      }
    }
  } catch (err) { fail(gateError, err.message || 'Unable to unlock your report.'); }
  finally { unlockButton.disabled = false; }
});
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function paragraph(parent, label, detail, extra) {
  const row = element('div', 'rs-insight');
  const strong = element('strong', '', label);
  if (extra) strong.append(element('span', 'rs-priority', extra));
  row.append(strong, element('p', '', detail));
  parent.append(row);
}
function render(data) {
  byId('overall-score').textContent = String(data.score);
  byId('ring-score').textContent = String(data.score);
  byId('verdict').textContent = data.verdict;
  byId('inferred-direction').textContent = 'Suggested direction: ' + data.inferredDirection;
  byId('percentile-note').textContent = data.percentileNote;
  byId('report-disclaimer').textContent = data.disclaimer;
  byId('orbit-action').textContent = data.nextOrbitAction;

  const ratings = byId('ratings');
  ratings.replaceChildren();
  for (const [key, label, max] of scoreDimensions) {
    const value = Math.min(max, Math.max(0, Number(data.ratings[key]) || 0));
    const row = element('div', 'rs-rating');
    const head = element('div', 'rs-rating-head');
    head.append(element('span', '', label), element('span', '', value + ' / ' + max));
    const track = element('div', 'rs-bar');
    const bar = element('i');
    bar.style.width = (value / max * 100) + '%';
    track.append(bar);
    row.append(head, track);
    ratings.append(row);
  }
  const strengths = byId('strengths'), gaps = byId('gaps'), companies = byId('companies');
  strengths.replaceChildren(); gaps.replaceChildren(); companies.replaceChildren();
  for (const item of data.strengths) paragraph(strengths, item.title, item.evidence);
  for (const item of data.gaps) paragraph(gaps, item.title, item.evidence + ' Next step: ' + item.nextStep, item.priority);
  for (const item of data.companyTargets) {
    const row = element('div', 'rs-company');
    row.append(element('b', '', item.company), element('span', '', item.role), element('span', 'rs-fit', item.fit), element('small', '', item.rationale));
    companies.append(row);
  }
}
byId('copy-report').addEventListener('click', async () => {
  if (!report) return;
  const summary = [
    'Orbit Resume Intelligence — ' + report.score + '/100',
    report.verdict,
    'Suggested direction: ' + report.inferredDirection,
    'Strengths:', ...report.strengths.map(x => '- ' + x.title + ': ' + x.evidence),
    'Improve next:', ...report.gaps.map(x => '- ' + x.title + ': ' + x.nextStep),
    'Company ideas (not offer probabilities):', ...report.companyTargets.map(x => '- ' + x.company + ': ' + x.role + ' (' + x.fit + ')'),
    report.percentileNote,
    report.disclaimer
  ].join('\n');
  try { await navigator.clipboard.writeText(summary); byId('result-status').textContent = 'Summary copied.'; }
  catch { byId('result-status').textContent = 'Copy unavailable on this device.'; }
});
byId('delete-report').addEventListener('click', async () => {
  if (!reportToken) return;
  byId('result-status').textContent = 'Deleting report…';
  try {
    await api('/api/resume-score/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: reportToken })
    });
    reportToken = ''; report = null;
    fileInput.value = '';
    byId('unlock-email').value = '';
    byId('marketing-consent').checked = false;
    reflectFile();
    show('upload-stage');
    fileName.textContent = 'Your report and unlock email have been deleted. Upload another résumé.';
  } catch {
    byId('result-status').textContent = 'We could not delete your report now. Please try again.';
  }
});
void initialize();
