import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const resume=read('resume-score/index.html')
const resumeJS=read('resume-score/resume-score.js')
const face=read('face-match/index.html')
const faceJS=read('face-match/face-match.js')
const start=read('start/index.html')
const startJS=read('start/start.js')
const intent=read('start/networking-intent.js')

test('Resume score converts company selection into a legitimate networking first task',()=>{
  assert.match(resume, /id="company-network-cta"/)
  assert.match(resume, /id="networking-next-cta"/)
  assert.match(resume, /Find alumni/)
  assert.match(resumeJS, /selectNetworkingTarget\(target\)/)
  assert.match(resumeJS, /logoDomain\(target\.company\)/)
  assert.match(resumeJS, /source: 'resume_evaluation'/)
  assert.match(resumeJS, /networking_cta_clicked/)
  assert.match(resumeJS, /result_viewed/)
  assert.doesNotMatch(resume, /class="rs-next"[^]*?Try Orbit free/i)
})

test('Face Match user chooses field; job suitability is never derived from the photo',()=>{
  assert.match(face, /data-networking-interest="Finance"/)
  assert.match(face, /data-networking-interest="Technology"/)
  assert.match(face, /data-networking-interest="Consulting"/)
  assert.match(face, /data-networking-interest="Startups"/)
  assert.match(faceJS,/selectedNetworkingIndustry/)
  assert.match(faceJS, /source:'face_match',industry:selectedNetworkingIndustry/)
  assert.match(faceJS, /networking_cta_clicked/)
  assert.match(face, /Your photo is just for fun/)
  assert.doesNotMatch(face, /your face determines your career/i)
})

test('Network goal is carried only in temporary session storage, never URL PII',()=>{
  assert.match(start, /id="networking-prep" hidden/)
  assert.match(startJS, /networkingIntent/)
  assert.match(startJS, /goal:networkingIntent.goal,detail:networkingIntent.detail/)
  assert.match(intent, /sessionStorage\.setItem\(KEY/)
  assert.match(intent, /15 \* 60 \* 1000/)
  assert.match(intent, /networking_activation/)
  assert.match(intent, /email: safeEmail/)
  assert.doesNotMatch(intent, /localStorage/)
  assert.doesNotMatch(intent, /query\.set\('email'/)
  assert.match(startJS, /if\(networkingIntent.email\)email.value/)
  assert.match(startJS, /form\.addEventListener\('submit'/)
})

test('Analytics are aggregate-only and marketing is not silently subscribed',()=>{
  assert.match(intent, /\/api\/public-tools\/event/)
  assert.match(intent, /navigator\.globalPrivacyControl === true/)
  assert.match(intent, /sessionId: id, event: stage/)
  assert.doesNotMatch(intent, /JSON\.stringify\(\{[^}]*email:[^}]*event:/)
  assert.match(resumeJS, /marketing-consent/)
  assert.doesNotMatch(faceJS, /\/api\/marketing\/subscribe/)
  assert.match(read('privacy/index.html'), /Networking continuation/)
})
