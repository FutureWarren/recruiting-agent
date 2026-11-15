import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const page = read('resume-score/index.html')
const script = read('resume-score/resume-score.js')
const stylesheet = read('resume-score/resume-score.css')
const builder = read('scripts/build-continuum-pages.mjs')
const sitemap = read('sitemap.xml')

test('Resume Intelligence is a complete public route in the production build', () => {
  assert.match(page, /<title>Free AI Resume Score/)
  assert.match(page, /rel="canonical" href="https:\/\/orbit-reaches\.com\/resume-score\/"/)
  assert.match(sitemap, /https:\/\/orbit-reaches\.com\/resume-score\/<\/loc>/)
  assert.match(builder, /'resume-score'/)
  assert.match(stylesheet, /color-scheme:dark/)
  assert.match(stylesheet, /prefers-reduced-motion:reduce/)
})

test('Email gate follows actual analysis, not a fabricated loading animation', () => {
  assert.match(page, /id="resume-form"/)
  assert.match(page, /id="resume-file"[^>]+type="file"/)
  assert.match(page, /id="gate-stage" hidden/)
  assert.match(page, /id="result-stage" hidden/)
  assert.match(script, /\/api\/resume-score\/config/)
  assert.match(script, /\/api\/resume-score\/analyze/)
  assert.match(script, /\/api\/resume-score\/unlock/)
  assert.match(script, /show\('gate-stage'\)/)
  assert.match(script, /show\('result-stage'\)/)
  assert.match(script, /if \(!result\.ready \|\| !result\.token\)/)
})

test('Captured unlock email does not implicitly authorize marketing', () => {
  assert.match(page, /type="checkbox" id="marketing-consent"/)
  assert.doesNotMatch(page, /id="marketing-consent"[^>]*\bchecked\b/)
  assert.match(page, /Marketing updates are optional/)
  assert.match(script, /if \(byId\('marketing-consent'\)\.checked\)/)
  assert.match(script, /consent: true, frequency: 'weekly'/)
  assert.doesNotMatch(script, /localStorage\.setItem\(.+reportToken/)
})

test('No invented percentile or claim of guaranteed interviews, and private output is safely rendered', () => {
  assert.match(page, /No fictitious applicant percentiles/)
  assert.match(page, /Illustrative fit, not interview or offer probability/)
  assert.match(page, /id="percentile-note"/)
  assert.match(page, /id="delete-report"/)
  assert.match(script, /\/api\/resume-score\/delete/)
  assert.match(script, /node\.textContent = text/)
  assert.doesNotMatch(script, /\.innerHTML\s*=/)
})
