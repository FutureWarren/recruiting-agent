# Orbit mobile task-first conversion — review candidate

## Why

Most website sessions are on phones, but Orbit executes LinkedIn/Gmail tasks locally in the desktop app. The old mobile first-paint email bottom sheet hid the actual video. This change makes the first phone experience **see the real product → configure a task → save the task → continue on desktop**.

## Web experience

- No automatic modal or mobile page scroll lock. The real existing product video appears in the mobile hero before any input is requested.
- A mobile-only composer asks for university and target industry and prepares an explicit *alumni networking / draft-only* brief. No resume, Gmail or LinkedIn password is requested on the site.
- The existing Handoff /start endpoint already stores optional `goal` and `detail`. Saving via email sends both fields; the desktop app opens the matching task through the signed handoff link after normal account sign-in.
- Real mobile installer CTAs redirect to the composer, or reopen the save sheet for an already prepared task. Desktop Mac and Windows download routing is unchanged.
- Copying a generic link does **not** save the prepared task, and the UI now says that clearly.
- Real email submission is explicit. No silent account creation, agent execution or sending email.
- A desktop user who has only downloaded Orbit must return to the continuation link and choose **Open Orbit and continue**. The deep link restores context but never authenticates the user.

## Video — separately review before replacing production media

Existing 1920×1080 demo and poster remain on the site. The new video is **not** deployed by this change.

Create two versions from an updated, verified live run:
1. 15–20 s silent first-screen cut: LinkedIn search → relevant profile → work email when actually found → Gmail draft; large readable captions, no fictional people or sending.
2. 45–60 s walkthrough: task input → research → email lookup → personalized draft → user review; caption that drafts are not sent automatically.

The older Oct 27 Descript assets can be used for editing reference, not as verified evidence of the latest app UI. Mask real emails and identifying student data; avoid fake UI, unverifiable speed/offer claims, and guarantee language. Upload the new media and lightweight poster only after it is reviewed. Keep a static poster fallback, mobile `playsinline`, and manual playback on constrained connections.

## Instrumentation and rollout

- Existing 7-day V2 session funnel and UTM attribution stay intact.
- New explicit stages: `demo_played_v3`, `task_config_started_v3`, `task_previewed_v3`.
- Backend PR must accept and report these stages **before** website main is merged. Otherwise the events are rejected (and ignored client-side), while the task handoff still works.
- Use distinct QR source/UTM tags per campus channel. Source must be attached to a session, not inferred from the phone OS.
- Verify site visit → explicit task configuration → preview → handoff email → real desktop-open → authenticated app-open → completed run; count browser sessions, not unique students.
- No website main merge, Pages deploy, backend deploy, or desktop installer release is included.

## QA

`npm test` exercises the production build using mocked handoff/email APIs and Chromium/WebKit. Verify 320 px phone, Android, iPad, Mac and Windows, privacy, clipboard fallback, no scroll overflow, unsent state, and handoff goal preservation. Backend test exercises accepted stage allowlist and trusted cohort metrics.

Rollback is a website revert. Backend schema is unchanged; new analytic fields are additive.
