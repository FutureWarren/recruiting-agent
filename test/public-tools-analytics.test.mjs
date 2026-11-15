import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('both free tools send anonymous pageview events but never raw uploaded data',()=>{
  const face=read('face-match/face-match.js'),resume=read('resume-score/resume-score.js')
  for(const s of [face,resume]){
    assert.match(s,/\/api\/public-tools\/view/)
    assert.match(s,/sessionStorage\.getItem/)
    assert.match(s,/crypto\.randomUUID\(\)/)
    assert.match(s,/credentials:'omit'/)
    assert.match(s,/navigator\.doNotTrack/)
  }
  assert.match(face,/tool:'face-match'/)
  assert.match(resume,/tool:'resume-evaluation'/)
  assert.doesNotMatch(face,/imageBase64.*public-tools\/view/)
  assert.doesNotMatch(resume,/fileBase64.*public-tools\/view/)
})
test('privacy notice discloses anonymous session-day measurement',()=>{
  const notice=read('privacy/index.html')
  assert.match(notice,/Free-tool analytics/)
  assert.match(notice,/stored only as a one-way hash/)
  assert.match(notice,/not a verified count of unique people/)
})
