/** Local browser E2E with a mocked backend: no real resume, email or AI provider calls. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
process.env.SITE_TEST_ROOT = 'dist'
const { serve } = await import('./static-server.mjs')
const server = await serve()
const report = {
  score: 82,
  rubricVersion: 'resume-rubric-v3',
  inferredDirection: 'Investment Banking',
  verdict: 'Strong finance profile. Add clearer outcomes to stand out.',
  ratings: { experience: 25, impact: 16, relevance: 15, clarity: 10, skills: 7, ats: 5, template: 4 },
  templateReview: {
    score:4, maximum:15, pageCount:3, pageCountVerified:true,
    checked:['PDF page count','Body font size'],
    issues:[{code:'overlong',title:'Too many pages',detail:'3 pages detected. Trim an early-career resume to one or two pages.',deduction:11}],
    note:'PDF pages and observed typography checked.'
  },
  strengths: [{ title: 'Finance exposure', evidence: 'Relevant internships' }, { title: 'Quantitative skills', evidence: 'Excel and valuation work' }],
  gaps: [{ title: 'Quantify your impact', evidence: 'Some bullets omit outcomes', nextStep: 'Add verified before-and-after numbers', priority: 'high' },
    { title: 'Tighten bullets', evidence: 'Descriptions run long', nextStep: 'Lead with a clear action verb', priority: 'medium' }],
  companyTargets: [
    { company: 'Goldman Sachs', role: 'Investment Banking Analyst', fit: 'realistic', rationale: 'Relevant internship and finance tools' },
    { company: 'Morgan Stanley', role: 'Finance Analyst', fit: 'realistic', rationale: 'Strong analytical background' },
    { company: 'BlackRock', role: 'Research Analyst', fit: 'stretch', rationale: 'Build more research outcomes' },
    { company: 'Jefferies', role: 'Banking Analyst', fit: 'realistic', rationale: 'Valuation experience' },
    { company: 'Citi', role: 'Credit Analyst', fit: 'stretch', rationale: 'Needs stronger credit samples' },
    { company: 'Lazard', role: 'Advisory Analyst', fit: 'exploratory', rationale: 'Try more transaction projects' }
  ],
  percentile: null,
  percentileNote: 'No verified population cohort.',
  disclaimer: 'Illustrative fit, not interview or offer probability.',
  nextOrbitAction: 'Reach out to analysts at firms that fit your interests.'
}
const browser = await chromium.launch({headless:true})
try {
  for (const [label, width, height] of [['desktop',1280,900], ['mobile',390,844]]) {
    const ctx = await browser.newContext({viewport:{width,height},reducedMotion:label==='mobile'?'reduce':'no-preference'})
    const requests = [], errors = [], handoffs = [], conversionEvents = []
    let scenario = 'success'
    await ctx.route('**/*', route => {
      const req = route.request(), url = new URL(req.url())
      if (url.origin === server.base) return route.continue()
      if (url.hostname === 'www.google.com' && url.pathname === '/s2/favicons') {
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOoSLnzHwAFyAK47GcG/QAAAABJRU5ErkJggg==', 'base64')
        return route.fulfill({ status: 200, contentType: 'image/png', body: png })
      }
      requests.push(url.pathname)
      if (url.pathname === '/api/public-tools/event') {
        conversionEvents.push(req.postDataJSON());
        return route.fulfill({status:204,body:''});
      }
      if (url.pathname === '/api/public-tools/view' || url.pathname === '/api/handoff/event') return route.fulfill({status:204,body:''});
      if (url.pathname === '/api/handoff/start') {
        handoffs.push(req.postDataJSON());
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({emailStatus:'accepted',continueUrl:server.base + '/continue/?token=fixture'})});
      }
      if (url.pathname === '/api/resume-score/config') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true,captchaSiteKey:''})})
      if (url.pathname === '/api/resume-score/analyze') {
        if (scenario === 'invalid_schema') return route.fulfill({ status:400, contentType:'application/json', body: JSON.stringify({ error:'[{"code":"invalid_type","expected":"object","path":["strengths",0]}]' }) })
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true,token:'x'.repeat(43)})})
      }
      if (url.pathname === '/api/resume-score/unlock') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({report: scenario === 'limited' ? { ...report, companyTargets: [], analysisStatus: 'limited' } : report})})
      // No real image-provider request during tests. The UI must keep initials as fallback.
      return route.abort()
    })
    const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(err.message))
    await page.goto(server.base + '/resume-score/')
    await page.locator('#analyze-button').waitFor({state:'visible'})
    await page.locator('#resume-file').setInputFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n' + 'fake test only\n'.repeat(50))})
    await page.locator('#analyze-button').click()
    await page.locator('#gate-stage:not([hidden])').waitFor()
    await page.locator('#unlock-email').fill('alex@example.test')
    await page.locator('#unlock-button').click()
    await page.locator('#result-stage:not([hidden])').waitFor()
    assert.equal(await page.locator('#overall-score').innerText(),'82')
    assert.equal(await page.locator('.rs-bubble').count(),6)
    assert.equal(await page.locator('.rs-bubble[aria-pressed="true"]').count(),1)
    await page.locator('.rs-bubble').first().click({force:true})
    assert.equal(await page.locator('#company-detail-name').innerText(),'Goldman Sachs')
    assert.ok((await page.locator('.rs-bubble img').count()) >= 5)
    await page.locator('.rs-bubble').nth(1).click({force:true})
    assert.equal(await page.locator('#company-detail-name').innerText(),'Morgan Stanley')
    assert.equal(await page.locator('#company-detail-role').innerText(),'Finance Analyst')
    assert.equal(await page.locator('#strengths .rs-insight').count(),2)
    assert.equal(await page.locator('#gaps .rs-insight').count(),2)
    await page.locator('#score-breakdown summary').click()
    assert.equal(await page.locator('#ratings .rs-rating').count(),7)
    assert.match(await page.locator('#template-score').innerText(),/4\s*\/\s*15/)
    assert.equal(await page.locator('#template-issues .rs-template-item').count(),1)
    assert.match(await page.locator('#template-issues').innerText(),/Too many pages/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,label+' horizontal overflow')
    if (label === 'mobile') {
      assert.equal(await page.locator('.rs-bubble').first().evaluate(n => getComputedStyle(n).animationName),'none')
    }
    assert.equal(requests.filter(p => p === '/api/marketing/subscribe').length,0,'no implicit marketing opt in')
    // Result-to-action bridge: a company chosen on the report becomes a prepared,
    // reviewed networking task, not an invented successful outreach campaign.
    assert.match(await page.locator('#networking-next-heading').innerText(), /Morgan Stanley/)
    assert.match(await page.locator('#networking-next-cta').innerText(), /Morgan Stanley/)
    await page.locator('#networking-next-cta').click()
    await page.waitForURL(/\/start\/\?/)
    assert.equal(new URL(page.url()).searchParams.get('source'), 'resume_evaluation')
    assert.match(await page.locator('#networking-prep-goal').innerText(),/Morgan Stanley/)
    assert.equal(await page.locator('#email').inputValue(),'alex@example.test')
    assert.equal(handoffs.length,0,'visiting start page must not email or submit anything')
    await page.locator('#submit').click()
    await page.locator('#success:not([hidden])').waitFor()
    assert.equal(handoffs.length,1)
    assert.equal(handoffs[0].email,'alex@example.test')
    assert.equal(handoffs[0].source,'resume_evaluation')
    assert.match(handoffs[0].goal,/Morgan Stanley/)
    assert.match(handoffs[0].detail,/my approval/)
    assert.equal(conversionEvents.filter(e=>e.event==='networking_cta_clicked').length,1)
    assert.equal(conversionEvents.every(e=>!('email' in e)&&!('company' in e)&&!('goal' in e)),true)

    // AI outage fallback: score remains unlocked without invented employer matches.
    scenario = 'limited'
    await page.goto(server.base + '/resume-score/')
    await page.locator('#resume-file').setInputFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n' + 'fake test only\n'.repeat(50))})
    await page.locator('#analyze-button').click()
    await page.locator('#gate-stage:not([hidden])').waitFor()
    await page.locator('#unlock-email').fill('alex@example.test')
    await page.locator('#unlock-button').click()
    await page.locator('#result-stage:not([hidden])').waitFor()
    assert.equal(await page.locator('#overall-score').innerText(), '82')
    assert.equal(await page.locator('.rs-bubble').count(), 0)
    assert.match(await page.locator('.rs-cloud-empty').innerText(), /unavailable/i)
    assert.match(await page.locator('#result-status').innerText(), /score is ready/i)
    // Regression for the production incident: raw schema diagnostics must never reach the UI.
    scenario = 'invalid_schema'
    await page.goto(server.base + '/resume-score/')
    await page.locator('#resume-file').setInputFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n' + 'fake test only\n'.repeat(50))})
    await page.locator('#analyze-button').click()
    await page.locator('#upload-error:not([hidden])').waitFor()
    const publicError = await page.locator('#upload-error').innerText()
    assert.match(publicError,/try again/i)
    assert.doesNotMatch(publicError,/invalid_type|expected|strengths|json|schema|\[\{|path/i)
    assert.deepEqual(errors,[],label+' JavaScript errors')
    await ctx.close()
    console.log('PASS '+label+': uploaded, unlocked, selected real companies, no unsolicited marketing')
  }
} finally {
  await browser.close()
  await server.close()
}
