// Code-native artwork and an illustrative UI, never a live email composer.
export const closingMark = `<div class="closing-orbit closing-sculpture" aria-hidden="true">
  <svg viewBox="0 0 240 190" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ceramic-edge" x1="48" y1="25" x2="189" y2="170" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff"/><stop offset=".48" stop-color="#bcbfcf"/><stop offset="1" stop-color="#f1f2fa"/></linearGradient>
      <linearGradient id="ceramic-face" x1="64" y1="40" x2="170" y2="161" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff"/><stop offset=".4" stop-color="#f5f6ff"/><stop offset=".76" stop-color="#d4d7e8"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
      <radialGradient id="satellite-pearl" cx=".3" cy=".2" r=".85"><stop stop-color="#e2dcff"/><stop offset=".46" stop-color="#ada0ff"/><stop offset="1" stop-color="#7361d7"/></radialGradient>
    </defs>
    <g transform="rotate(-24 120 95)">
      <ellipse cx="120" cy="103" rx="76" ry="65" stroke="url(#ceramic-edge)" stroke-width="22"/>
      <ellipse cx="120" cy="94" rx="76" ry="65" stroke="url(#ceramic-face)" stroke-width="22"/>
      <ellipse cx="120" cy="94" rx="86" ry="75" stroke="#ffffff" stroke-opacity=".8" stroke-width="1.3"/>
      <ellipse cx="120" cy="94" rx="65" ry="54" stroke="#ffffff" stroke-opacity=".8" stroke-width="1"/>
      <circle cx="174" cy="47" r="13" fill="url(#satellite-pearl)"/>
      <ellipse cx="170" cy="42" rx="4" ry="2.5" fill="#fff" opacity=".45"/>
    </g>
  </svg>
</div>`;

const icons = {
  resume: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 8h4m-4 4h4m-4 4h3"/>',
  person: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  tone: '<path d="M5 9v6m4-10v14m4-12v10m4-8v6m4-5v4"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">${icons[name]}</svg>`;

export const personalDemo = `<section id="profile" class="personal-section concise-personal"><div class="shell">
  <div class="personal-heading motion-reveal"><h2>A personal email.<br><span>Not a template.</span></h2><p>A little of you. A reason to connect.</p></div>
  <div class="personal-studio" data-email-story data-phase="3" aria-label="Illustrative personalized email walkthrough">
    <div class="source-stack" role="group" aria-label="Explore what shapes the draft">
      <button class="source-card" type="button" data-story-phase="0" aria-pressed="false" aria-controls="email-example-title"><span class="source-icon">${icon('resume')}</span><span class="source-content"><small>Your résumé</small><strong>Jamie Chen</strong><span>NYU · Finance</span><span class="source-evidence">Student healthcare fund</span></span><span class="source-arrow" aria-hidden="true">↗</span></button>
      <button class="source-card" type="button" data-story-phase="1" aria-pressed="false" aria-controls="email-example-title"><span class="source-icon">${icon('person')}</span><span class="source-content"><small>Their work</small><strong>Alex Morgan</strong><span>Healthcare advisory</span><span class="source-evidence">NYU alumnus</span></span><span class="source-arrow" aria-hidden="true">↗</span></button>
      <button class="source-card" type="button" data-story-phase="2" aria-pressed="false" aria-controls="email-example-title"><span class="source-icon">${icon('tone')}</span><span class="source-content"><small>Your voice</small><strong>Warm & concise</strong><span class="tone-sample"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="source-evidence">A 15-minute conversation</span></span><span class="source-arrow" aria-hidden="true">↗</span></button>
    </div>
    <div class="context-bridge" aria-hidden="true"><svg viewBox="0 0 120 400" preserveAspectRatio="none"><path d="M0 62H24Q46 62 46 92V170Q46 200 70 200H120" data-flow="0"/><path d="M0 200H120" data-flow="1"/><path d="M0 338H24Q46 338 46 308V230Q46 200 70 200H120" data-flow="2"/></svg><span class="bridge-core"><i class="orbit-mark"></i></span></div>
    <div class="email-surround"><article class="email-example" aria-labelledby="email-example-title">
      <div class="email-chrome"><span class="brand"><i class="orbit-mark" aria-hidden="true"></i>Orbit</span><span>Example draft</span></div>
      <div class="email-subject"><span>Subject</span><h3 id="email-example-title">A fellow NYU student exploring banking</h3></div>
      <div class="email-body"><p>Hi Alex,</p><p>I’m a finance student at <mark data-context="0">NYU</mark>, where I work on a <mark data-context="0">student healthcare fund</mark>.</p><p>Your path into <mark data-context="1">healthcare advisory</mark> caught my attention. As a fellow NYU student, I’d love to hear what helped you find your footing.</p><p>Would you be open to a <mark data-context="2">15-minute conversation</mark> next week?</p><p>Thank you,<br>Jamie</p></div>
      <div class="email-approval"><span class="approval-symbol" aria-hidden="true">✓</span> Prepared for your review. Not sent.</div>
    </article></div>
    <div class="story-controls"><div class="story-status"><span class="story-indicator" aria-hidden="true"></span><span data-story-caption>Ready for your review</span></div><div class="story-timeline" aria-hidden="true"><i></i></div><button type="button" data-story-replay aria-label="Replay email personalization animation">Replay <span aria-hidden="true">↻</span></button></div>
  </div>
  <p class="email-disclaimer">Illustrative example. Your drafts use your own background and research.</p>
</div></section>`;
