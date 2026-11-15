/** Local browser E2E with a mocked backend: no real resume, email or AI provider calls. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
process.env.SITE_TEST_ROOT = 'dist'
const { serve } = await import('./static-server.mjs')
const server = await serve()
const report = {
  score: 82,
  rubricVersion: 'resume-rubric-v2',
  inferredDirection: 'Investment Banking',
  verdict: 'Strong finance profile. Add clearer outcomes to stand out.',
  ratings: { experience: 25, impact: 16, relevance: 17, clarity: 12, skills: 8, ats: 4 },
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
    const requests = [], errors = []
    let scenario = 'success'
    await ctx.route('**/*', route => {
      const req = route.request(), url = new URL(req.url())
      if (url.origin === server.base) return route.continue()
      if (url.hostname === 'www.google.com' && url.pathname === '/s2/favicons') {
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOoSLnzHwAFyAK47GcG/QAAAABJRU5ErkJggg==', 'base64')
        return route.fulfill({ status: 200, contentType: 'image/png', body: png })
      }
      requests.push(url.pathname)
      if (url.pathname === '/api/resume-score/config') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true,captchaSiteKey:''})})
      if (url.pathname === '/api/resume-score/analyze') {
        if (scenario === 'invalid_schema') return route.fulfill({ status:400, contentType:'application/json', body: JSON.stringify({ error:'[{"code":"invalid_type","expected":"object","path":["strengths",0]}]' }) })
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true,token:'x'.repeat(43)})})
      }
      if (url.pathname === '/api/resume-score/unlock') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({report})})
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
    assert.equal(await page.locator('#ratings .rs-rating').count(),6)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,label+' horizontal overflow')
    if (label === 'mobile') {
      assert.equal(await page.locator('.rs-bubble').first().evaluate(n => getComputedStyle(n).animationName),'none')
    }
    assert.equal(requests.filter(p => p === '/api/marketing/subscribe').length,0,'no implicit marketing opt in')
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
