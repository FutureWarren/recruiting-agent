# Face Match — backend integration contract

Frontend: `/face-match/`. Independent of `/resume-score/`; does not change any resume scoring.

## Endpoint (implemented in paired backend PR #422; not deployed)
`POST /api/face-match/analyze` on the Orbit backend.
Request: `{imageBase64: string, mimeType:"image/jpeg", consent:true}`. Images are downsampled in browser to at most 1280 px long side. Validate image bytes, content type and <=5 MB decoded server-side.

Successful response:
```json
{
  "title": "Wall Street Energy",
  "tagline": "Tailored, composed and camera-ready.",
  "explanation": "Your structured outfit and neutral background create a polished editorial look.",
  "tags": ["Tailored", "Clean backdrop", "Editorial"],
  "matches": [
    {"id":"wall-street","score":92},
    {"id":"consulting","score":83},
    {"id":"tech","score":55},
    {"id":"founder","score":67},
    {"id":"client-facing","score":73}
  ]
}
```
All five unique ids required, scores integer 0..100. Scores must reflect a **photo-style rubric**, not hiring likelihood or face-based aptitude, and should not be described as calibrated probabilities. The example above is contract documentation only; client never displays example or fabricated output.

## Recommended analysis constraints
Use a low-cost image-capable model, structured JSON with server-side schema validation and deterministic style-rubric weights. Only assess observable photo styling: clothing formality, outfit color palette, lighting, background, framing and visible expression. Do not score facial attractiveness, body type, ethnicity, gender, inferred age, health, mental state, intelligence, trustworthiness or career aptitude. Avoid beauty rankings and discriminatory hiring conclusions. Use neutral, encouraging copy and explain the visible cues supporting each aesthetic.

Set `Cache-Control: no-store`; do not store raw photos, logs containing imageBase64 or identifying embeddings. Require affirmative consent, rate limit by IP/session, enforce request-timeout/model-token limits and daily spend caps. Prefer service-side Cloudflare Turnstile if unauthenticated and public. CORS must allow `https://orbit-reaches.com` and intended preview origins. Return concise safe errors. Backend rollout should occur before the frontend feature is linked publicly.

## QA acceptance
- Camera permission asked only on click; fallback to upload if denied.
- iOS Safari, Android Chrome, desktop Safari/Chrome, reduced-motion preference.
- No API response or invalid response => friendly error and retry; never random scores.
- No login and no email gate; one-time analysis consent explicit.
- Result card export stays in the browser; share does not expose a private report URL.
- Verify privacy policy covers third-party image processor, retention, geographic transfers and user rights before public launch.
- Performance and abuse testing required before enabling web discoverability.

## Paired implementation
Backend draft PR: https://github.com/FutureWarren/Future/pull/422. The backend feature is disabled by default and must be deployed from its PR before switching `FACE_MATCH_ENABLED=true` in a verified environment. Website must not be merged before this dependency is green. The backend currently reserves a daily count in Postgres and uses an in-memory IP rate limiter. It does not save uploaded photographs or completed reports.
