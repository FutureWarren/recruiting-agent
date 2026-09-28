/** Read-only release gate. Never scale old production values to make this pass. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const contract = JSON.parse(readFileSync(new URL('../pricing/credit-v2.json', import.meta.url), 'utf8'))
const endpoint = 'https://backend-production-2b40.up.railway.app/api/auth/config'
const response = await fetch(endpoint, {signal:AbortSignal.timeout(20000)})
assert.ok(response.ok(), `Production plan configuration unavailable: HTTP ${response.status}`)
const data = await response.json()
assert.ok(Array.isArray(data.plans), 'Production did not return plans')
const mismatch = []
for (const plan of contract.plans) {
  const matches = data.plans.filter(p => p.id === plan.id)
  if (matches.length !== 1) { mismatch.push(`${plan.id}: missing or duplicate plan`); continue }
  const live = matches[0]
  if (live.credits !== plan.credits || live.priceUsd !== plan.priceUsd) {
    mismatch.push(`${plan.id}: production $${live.priceUsd}/${live.credits} credits; website $${plan.priceUsd}/${plan.credits} credits`)
  }
}
if (data.freeLaunch !== false || data.billingEnabled !== true || data.billingProvider !== 'stripe') mismatch.push('Public paid-plan availability differs from the website')
assert.equal(mismatch.length, 0, `Do not deploy mismatched pricing. Resolve the backend rollout first:\n${mismatch.join('\n')}`)
console.log('Production plan prices, allowances and paid-plan availability match the website Credit V2 contract. Metering weights are source-reviewed separately.')
