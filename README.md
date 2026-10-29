# Orbit

Orbit is an AI recruiting agent for ambitious students. It researches relevant
professionals, verifies contact information, and prepares personalized outreach
grounded in your real background — inside a browser you can watch, redirect,
pause, or stop at any time.

### [→ Download Orbit for Apple Silicon Mac](https://orbit-reaches.com/)

Built for ambitious students. The current public launch supports Apple Silicon
Macs running macOS 11 or later.

## Which file do I want?

Use the download page above whenever possible. If you are on the
[releases](https://github.com/FutureWarren/recruiting-agent/releases) page
instead, choose:

| You have | Download |
| --- | --- |
| **Mac**, Apple Silicon (M1 and later) | `Orbit-<version>-arm64.dmg` |

Everything else in a release — historical Windows/Intel installers, `.zip`,
`.blockmap`, and `latest*.yml` files — is not part of the current public
launch surface.

---

This repository hosts Orbit's public site and released desktop builds. The
application source lives in a private repository.

## Website build and deployment

The owner-approved Continuum design covers the homepage and ten public pages.
Only the website is deployed: no desktop app release, backend deployment,
pricing change, or change to the email handoff service is involved.

```sh
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:8767/preview/continuum/` for the protected design preview.
It blocks external non-read requests, so reviewing the form cannot send emails.
The preview server listens on loopback only. Running a local build does not publish.

- `src/signature-model.js`: original Orbit layered ring and purple satellite.
- `src/continuum.js`: scroll-linked motion, company strip, visual email story,
  pause/reduced-motion controls and lifecycle cleanup.
- `scripts/build-production.mjs`: produces `dist/` from the approved preview,
  restores public routes/indexing and working email services, excludes QA files.
- `home.js`, `mobile.js`, `start/start.js`, `continue/continue.js`: unchanged
  platform detection, immediate phone email sheet, optional no-email copy link,
  explicit-submit delivery states, and desktop continuation.
- Pricing, legal prose, business form scripts and Admin remain unchanged;
  the public pages receive a shared dark visual skin.

`npm run test:unit` checks layout contracts, source parity, pricing, legal content,
all public links, asset hashes and publish exclusions. CI runs `npm test` in
Chromium and WebKit; all external browser-test requests are mocked or blocked.
No test sends real email, creates real telemetry, starts a campaign or installs
an app. Test screenshots are saved only as CI artifacts, never published.

GitHub Pages publishes **only `dist/`** after build, tests and the read-only
production pricing parity gate pass. `site-release.json` identifies the exact
source commit and content hashes. `npm run test:live` verifies those hashes with
GET requests only. To roll back this website-only rollout, revert its merge
commit and let the existing Pages workflow publish the prior site; no backend
or user-data rollback is needed. Legacy tests remain available for reference.
