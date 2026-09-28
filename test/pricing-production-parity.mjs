/** Read-only release gate. Never scale legacy values to make this pass. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
export const contract = JSON.parse(readFileSync(new URL('../pricing/credit-v2.json', import.meta.url), 'utf8'))
export const endpoint = 'https://backend-production-2b40.up.railway.app/api/auth/config'

export function assertPricingParity(data, expected = contract) {
  assert.ok(Array.isArray(data?.plans), 'Production did not return plans')
  const mismatch = []
  for (const plan of expected.plans) {
    const matches = data.plans.filter(p => p.id === plan.id)
    if (matches.length !== 1) { mismatch.push(`${plan.id}: missing or duplicate plan`); continue }
    const live = matches[0]
    if (live.credits !== plan.credits || live.priceUsd !== plan.priceUsd) {
      mismatch.push(`${plan.id}: production $${live.priceUsd}/${live.credits} credits; website $${plan.priceUsd}/${plan.credits} credits`)
    }
  }
  const system = data.creditSystem
  if (system?.version !== expected.schemaVersion || system?.denominationScale !== expected.denominationScale) {
    mismatch.push('Production Credit V2 version/denomination is missing or different')
  }
  for (const [kind, weight] of Object.entries(expected.metering)) {
    if (system?.weights?.[kind] !== weight) mismatch.push(`${kind}: production metering weight does not match ${weight}`)
  }
  if (data.freeLaunch !== false || data.billingEnabled !== true || data.billingProvider !== 'stripe') mismatch.push('Public paid-plan availability differs from the website')
  assert.equal(mismatch.length, 0, `Do not deploy mismatched pricing. Resolve the backend rollout first:\n${mismatch.join('\n')}`)
}

export async function verifyProduction(fetcher = fetch) {
  const response = await fetcher(endpoint, { signal: AbortSignal.timeout(20000) })
  assert.ok(response.ok, `Production plan configuration unavailable: HTTP ${response.status}`)
  const data = await response.json()
  assertPricingParity(data)
  return data
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyProduction()
  console.log('Production prices, allowances, Credit V2 version/weights and paid-plan availability match the website.')
}
