# Mobile-first landing, approved 2026-10-13

## Boundaries

- Mobile/tablet OS detection, not a narrow desktop-window breakpoint.
- `home.js`, `home.css`, the desktop DOM and both installer routes remain unchanged.
- The actual existing 1920x1080, approximately 36-second demo is moved into the mobile hero. No new footage, fabricated product UI, claims, testimonials or logos.
- No backend, pricing, credits, app release or campaign changes.

## Experience

The mobile email bottom sheet is visible at first paint through a tiny head classifier and scoped CSS, before the deferred scripts or video finish loading. There is no click requirement, timer, scroll threshold or remembered-dismissal gate. The dialog receives focus, not the input: the keyboard does not cover the hero until the visitor taps the email field.

Visitors can dismiss the sheet, watch the real demo in the first screen, and reopen via Get Orbit. Dismissal does not cause repeated prompts while scrolling. Only one email is requested. Any valid email is accepted; no resume, name, university or prompt is required. Copy desktop link is available before submitting an email, with a selectable-text fallback for restricted clipboards. Copying a generic link does not claim an account or preserve identity.

Existing V2 attribution and email delivery states are retained. Automatic display emits neither a CTA click nor an email-start event. Submit/copy are deliberate intent. Provider acceptance is not delivery, and neither is a download or first run. Tests mock all handoff API calls, including public-site verification, to avoid polluting acquisition or sending test emails.

## Checks

- Byte hashes for the existing desktop HTML (after removing isolated mobile includes), CSS, JS and real demo.
- Chromium and WebKit phone/iPad cases, immediate sheet with deferred JS held back, email-only capture, clipboard fallback, error and accepted states.
- Mac/Windows screenshots compared with the deployed baseline at 640px and 1440px; only moving video pixels are masked.
- Existing installer, desktop interactions, commercial/pricing and no-JS fallback tests retained.
- Live download/mobile checks run on main after Pages has time to publish. No live handoff form is submitted.

Roll back the mobile changes by reverting this commit; no backend migration or data rollback is needed.
