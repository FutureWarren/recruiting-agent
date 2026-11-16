# Face Match — Unified Local Company Logo Assets

These self-contained SVG marks are loaded from the same `orbit-reaches.com` origin for the **Face Match results page and the 1080 × 1920 Face Match Story PNG**. No external image host is contacted at export time, so iOS Safari/Chrome can use Canvas export without CORS tainting.

## Sources

| Local file | Source repository/path |
| --- | --- |
| `google.svg`, `meta.svg`, `nvidia.svg`, `notion.svg`, `figma.svg`, `linear.svg`, `airbnb.svg`, `hubspot.svg`, `goldmansachs.svg` | `simple-icons/simple-icons/icons/<slug>.svg` |
| `salesforce.svg` | `gilbarbara/logos/logos/salesforce.svg` |
| `mckinsey.svg` | `finopsfoundation/framework/_tools-services/logos/mckinsey.svg` |
| `bain.svg` | `resumx/resumx/assets/icons/bain.svg` |
| `morganstanley.svg` | `finos/common-cloud-controls/website/static/img/firms/MorganStanley.svg` |
| `jpmorgan.svg` | `ag-grid/ag-grid/documentation/ag-grid-docs/src/components/showcase/images/jpmorgan.svg` |
| `bcg.svg` | `confident-ai/deepeval/docs/public/icons/companies/bcg.svg` |

The icons are used *only* as playful, descriptive editorial references to brand aesthetics. The matching results do not measure hiring potential, and the listed brands have not sponsored, endorsed or affiliated themselves with Orbit. Trademark rights remain with their respective owners. Some companies publish further usage restrictions; check approval before using their marks in paid advertising, co-branded promotions or official partnership claims.

## Live results and Story parity

- **Main Brand-Vibe Twin:** displays the approved company SVG within a readable wide logo tile, with an initials fallback.
- **Other company choices:** display their own company SVGs rather than blurred favicon proxies; company names remain visible.
- **All five Career Aura rows:** display representative sector company SVGs alongside the scores; the user's specifically selected match supersedes the representative when its category matches.
- Every brand domain returned by the backend maps to exactly one local SVG. No Google favicon URLs or third-party requests are needed for result-page logos.
- The official company SVGs are not modified or AI-generated. Company names remain visible if an SVG fails to load. No endorsement or employment prediction is implied.

## Implementation contract

- Allowlist in `face-match/face-match.js` maps a trusted company domain to a local SVG only.
- For the first three matches: use the server-selected matching brand if that sector is shown; otherwise use the curated sector's illustrative company example.
- For the main Brand-Vibe Twin: use only the actual brand returned by the backend. Never fabricate a main company if the backend returns `null` for an ambiguous photo.
- Render company mark on light tiles with original proportions, not an AI-drawn imitation or altered corporate logo. A missing asset gracefully falls back to readable company text; Canvas must still export a shareable PNG and QR code.
- Default to this same Story for every user who explicitly taps `Save Story` or `Share result`. Never share photos automatically.
- The URL QR remains an independently verified, offline-embedded matrix for `https://orbit-reaches.com/face-match/`.
