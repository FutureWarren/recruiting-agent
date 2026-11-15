'use strict';

// Public, no-login funnel. Never upload until the visitor submits a résumé.
// Scores are not generated or shown until the server has actually analyzed it.
const API = 'https://backend-production-2b40.up.railway.app';
const byId = id => document.getElementById(id);
const stages = ['upload-stage', 'loading-stage', 'gate-stage', 'result-stage'];
const scoreDimensions = [
  ['experience', 'Relevant experience', 25],
  ['impact', 'Quantified impact', 20],
  ['relevance', 'Role relevance', 15],
  ['clarity', 'Clarity and structure', 10],
  ['skills', 'Evidence of skills', 10],
  ['ats', 'ATS readability', 5],
  ['template', 'Template & layout', 15]
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
  if (!response.ok) {
    // Never display stack traces, model validation diagnostics or arbitrary server output.
    const message = typeof data.error === 'string' ? data.error : '';
    const safe = message.length > 0 && message.length <= 175 &&
      !/[{}\[\]\\\r\n]/.test(message) &&
      !/invalid.type|invalid.value|zod|expected|received|stack trace|traceback|json|schema|path.*strengths/i.test(message);
    throw new Error(safe ? message : 'We couldn’t finish this review. Please try again.');
  }
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

const VERIFIED_LOGO_DOMAINS = Object.freeze({
  'goldman sachs':'goldmansachs.com',
  'morgan stanley':'morganstanley.com',
  'jpmorgan':'jpmorganchase.com', 'j.p. morgan':'jpmorganchase.com', 'jpmorgan chase':'jpmorganchase.com',
  'blackrock':'blackrock.com', 'citi':'citi.com', 'citigroup':'citi.com',
  'jefferies':'jefferies.com', 'houlihan lokey':'hl.com', 'lazard':'lazard.com',
  'evercore':'evercore.com', 'moelis':'moelis.com', 'moelis & company':'moelis.com',
  'pjt partners':'pjtpartners.com', 'bank of america':'bankofamerica.com',
  'wells fargo':'wellsfargo.com', 'barclays':'barclays.com', 'ubs':'ubs.com',
  'rbc':'rbc.com', 'raymond james':'raymondjames.com',
  'bloomberg':'bloomberg.com', 'vanguard':'vanguard.com', 'fidelity':'fidelity.com',
  'state street':'statestreet.com', 'capital one':'capitalone.com',
  'jane street':'janestreet.com', 'citadel':'citadel.com', 'two sigma':'twosigma.com',
  'hudson river trading':'hudsonrivertrading.com', 'bridgewater':'bridgewater.com',
  'aqr':'aqr.com', 'de shaw':'deshaw.com',
  'google':'google.com', 'alphabet':'abc.xyz', 'meta':'meta.com',
  'microsoft':'microsoft.com', 'amazon':'amazon.com', 'apple':'apple.com',
  'nvidia':'nvidia.com', 'tesla':'tesla.com', 'openai':'openai.com',
  'stripe':'stripe.com', 'databricks':'databricks.com',
  'salesforce':'salesforce.com', 'adobe':'adobe.com', 'figma':'figma.com',
  'notion':'notion.so', 'palantir':'palantir.com', 'ibm':'ibm.com',
  'deloitte':'deloitte.com', 'pwc':'pwc.com', 'kpmg':'kpmg.com',
  'ey':'ey.com', 'accenture':'accenture.com', 'mckinsey':'mckinsey.com',
  'bain':'bain.com', 'bain & company':'bain.com', 'boston consulting group':'bcg.com',
  'bcg':'bcg.com', 'oliver wyman':'oliverwyman.com',
  'nike':'nike.com', 'disney':'disney.com', 'spotify':'spotify.com',
  'uber':'uber.com', 'airbnb':'airbnb.com', 'american express':'americanexpress.com'
});
function logoDomain(company) {
  // All image hosts and domains are fixed, never taken from model output.
  const key = String(company).toLowerCase().trim().replace(/\s+/g, ' ');
  return Object.prototype.hasOwnProperty.call(VERIFIED_LOGO_DOMAINS, key) ? VERIFIED_LOGO_DOMAINS[key] : null;
}
function initials(name) {
  const words = String(name).replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : (words[0] || '?').slice(0, 2).toUpperCase();
}
function renderCompanyCloud(targets) {
  const container = byId('companies');
  container.replaceChildren();
  const detail = {
    fit: byId('company-detail-fit'),
    company: byId('company-detail-name'),
    role: byId('company-detail-role'),
    rationale: byId('company-detail-rationale')
  };
  const priority = { realistic: 0, stretch: 1, exploratory: 2 };
  const sorted = (Array.isArray(targets) ? [...targets] : []).sort((a,b) => (priority[a.fit] ?? 2) - (priority[b.fit] ?? 2)).slice(0, 7);
  if (!sorted.length) {
    container.classList.add('is-empty');
    container.append(element('p', 'rs-cloud-empty', 'Company map unavailable for this review.'));
    detail.fit.textContent = 'Score ready';
    detail.company.textContent = 'Explore your next step';
    detail.role.textContent = 'Your resume score is still available';
    detail.rationale.textContent = 'Company suggestions didn’t complete. The scoring breakdown and next steps below are available.';
    return;
  }
  container.classList.remove('is-empty');
  const items = [];
  // Avoid accidental hover selection when bubbles appear underneath an idle cursor.
  // The user must move the pointer inside the map after it is rendered.
  let hoverArmed = false;
  container.addEventListener('pointermove', () => { hoverArmed = true }, { once: true });
  function select(i) {
    const target = sorted[i];
    if (!target) return;
    detail.fit.textContent = target.fit === 'realistic' ? 'Closest alignment' : target.fit === 'stretch' ? 'Stretch path' : 'Explore';
    detail.company.textContent = target.company;
    detail.role.textContent = target.role;
    detail.rationale.textContent = target.rationale;
    items.forEach((node, index) => node.setAttribute('aria-pressed', String(index === i)));
  }
  sorted.forEach((item, i) => {
    const bubble = element('button', 'rs-bubble');
    bubble.type = 'button';
    bubble.setAttribute('aria-label', item.company + ' · ' + item.role);
    bubble.setAttribute('aria-pressed', 'false');
    const wrap = element('span', 'rs-bubble-icon');
    wrap.append(element('span', 'rs-bubble-initials', initials(item.company)));
    const domain = logoDomain(item.company);
    if (domain) {
      const img = document.createElement('img');
      img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128';
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.loading = i < 3 ? 'eager' : 'lazy';
      img.onerror = () => img.remove();
      wrap.append(img);
    }
    bubble.append(wrap, element('span', 'rs-bubble-label', item.company));
    bubble.addEventListener('click', () => select(i));
    bubble.addEventListener('mouseenter', () => { if (hoverArmed) select(i); });
    bubble.addEventListener('pointermove', () => { if (hoverArmed) select(i); });
    bubble.addEventListener('focus', () => select(i));
    container.append(bubble);
    items.push(bubble);
  });
  if (sorted.length) select(0);
}
function renderTemplate(review) {
  const preview = byId('template-issues');
  const expanded = byId('template-all-issues');
  preview.replaceChildren();
  expanded.replaceChildren();
  const score = byId('template-score');
  const note = byId('template-note');
  const issues = Array.isArray(review?.issues) ? review.issues : [];
  if (!review || !Number.isInteger(review.score)) {
    score.textContent = 'Not assessed';
    preview.append(element('p', 'rs-template-empty', 'Analyze again to check formatting and page length.'));
    note.textContent = '';
    return;
  }
  score.textContent = review.score + ' / 15';
  const pages = Number.isInteger(review.pageCount) ? review.pageCount + (review.pageCount === 1 ? ' page' : ' pages') : 'Page count unverified';
  note.textContent = pages + ' · ' + (review.note || '');
  function issueCard(item) {
    const card = element('div', 'rs-template-item');
    card.append(element('strong', '', item.title || 'Formatting issue'));
    card.append(element('span', '', item.detail || ''));
    if (item.deduction > 0) card.append(element('span', 'rs-template-deduction', '−' + item.deduction + ' template pts'));
    return card;
  }
  if (!issues.length) preview.append(element('p', 'rs-template-empty',
    review.checked?.length ? 'No major layout issues detected.' : 'Page layout could not be fully inspected.'));
  for (const issue of issues.slice(0, 2)) preview.append(issueCard(issue));
  for (const issue of issues) expanded.append(issueCard(issue));
}
function render(data) {
  byId('overall-score').textContent = String(data.score);
  byId('verdict').textContent = data.verdict;
  byId('inferred-direction').textContent = data.inferredDirection;
  byId('percentile-note').textContent = data.percentileNote;
  byId('report-disclaimer').textContent = data.disclaimer;
  byId('orbit-action').textContent = data.nextOrbitAction;
  renderTemplate(data.templateReview);
  byId('result-status').textContent = data.analysisStatus === 'limited'
    ? 'Your score is ready. Some optional AI suggestions were unavailable.' : '';
  const ratings = byId('ratings');
  ratings.replaceChildren();
  const legacyDimensions = [
    ['experience','Relevant experience',30],['impact','Quantified impact',20],
    ['relevance','Role relevance',20],['clarity','Clarity and structure',15],
    ['skills','Evidence of skills',10],['ats','ATS readability',5]
  ];
  const dimensions = data.rubricVersion === 'resume-rubric-v2' ? legacyDimensions : scoreDimensions;
  for (const [key, label, max] of dimensions) {
    // Reports issued before rubric v3 have no template score; don't falsely show 0/15.
    if (!Number.isFinite(data.ratings?.[key])) continue;
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
  const strengths = byId('strengths'), gaps = byId('gaps');
  strengths.replaceChildren(); gaps.replaceChildren();
  for (const item of data.strengths.slice(0, 3)) paragraph(strengths, item.title, item.evidence);
  for (const item of data.gaps.slice(0, 3)) paragraph(gaps, item.title, item.nextStep, item.priority);
  renderCompanyCloud(data.companyTargets);
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
