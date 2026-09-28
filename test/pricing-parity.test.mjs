import test from 'node:test'
import assert from 'node:assert/strict'
import { assertPricingParity, verifyProduction, contract } from './pricing-production-parity.mjs'
const valid = () => ({ plans: contract.plans.map(({id,priceUsd,credits}) => ({id,priceUsd,credits})), billingEnabled:true, billingProvider:'stripe', freeLaunch:false, creditSystem:{version:2,denominationScale:10,weights:{...contract.metering}} })
test('matching production contract passes without any writes', async () => {
  assert.doesNotThrow(() => assertPricingParity(valid()))
  let calls=0
  const result=await verifyProduction(async(url, options)=>{calls++;assert.match(url,/\/api\/auth\/config$/);assert.equal(options.method,undefined);return {ok:true,status:200,json:async()=>valid()}})
  assert.equal(calls,1);assert.equal(result.plans[1].credits,2000)
})
test('legacy 1x amounts fail, rather than being silently multiplied',()=>{const d=valid();d.plans.forEach(p=>p.credits/=10);assert.throws(()=>assertPricingParity(d),/Do not deploy mismatched pricing/)})
test('matching numbers with missing/wrong metering metadata still fail',()=>{
  const missing=valid();delete missing.creditSystem;assert.throws(()=>assertPricingParity(missing),/version\/denomination/)
  const wrong=valid();wrong.creditSystem.weights.outreach=1;assert.throws(()=>assertPricingParity(wrong),/outreach/)
})
test('amount, duplicate/missing plan and disabled checkout mismatches fail',()=>{
  const amount=valid();amount.plans[1].priceUsd=1;assert.throws(()=>assertPricingParity(amount),/basic/)
  const dup=valid();dup.plans.push({...dup.plans[0]});assert.throws(()=>assertPricingParity(dup),/duplicate/)
  const absent=valid();absent.plans.pop();assert.throws(()=>assertPricingParity(absent),/jobpass/)
  const disabled=valid();disabled.billingEnabled=false;assert.throws(()=>assertPricingParity(disabled),/availability/)
})
test('fetch Response.ok is a boolean; non-2xx/network failure blocks publication',async()=>{
  await assert.rejects(verifyProduction(async()=>({ok:false,status:503,json:async()=>valid()})),/HTTP 503/)
  await assert.rejects(verifyProduction(async()=>{throw Error('offline')}),/offline/)
})
