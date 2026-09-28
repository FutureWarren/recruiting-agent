# Credit V2 website pricing — pending backend alignment

## Scope
Update the pricing page and section 7 of the public terms to the already intended Credit V2 rules. Dollar prices, billing intervals, homepage layout/media/download behavior, Stripe configuration and actual account balances are unchanged. This is not an entitlement migration.

The public contract is `pricing/credit-v2.json`. The static rendered cards, visible amounts, periods and 2/3/5 charging explanation are checked against it by `test/commercial-pages.mjs`.

## Publication blocker discovered September 28, 2026
A read-only request to the production public account configuration at 05:52:56 UTC still returned allowances 30 / 200 / 600 / 3000 / 2000, while the intended V2 configuration is 300 / 2000 / 6000 / 30000 / 20000. Dollar prices matched. Public Stripe billing was enabled. Do not multiply the live values in the website to conceal this mismatch.

Keep this change in a DRAFT PR. Before publication, the failed backend migration/deployment must be repaired and the actual production configuration verified. Code merged into an application repository and a successfully signed desktop build do not prove the backend was upgraded.

## Release checks
1. Repair and test the backend upgrade from its existing legacy schema without clearing balances or usage history. Verify migration idempotency and the intended 2/3/5 metering.
2. Verify the running production service, not only repository defaults, returns the V2 plan allowances.
3. Run `node test/pricing-production-parity.mjs`. It reads only public configuration. It does not authenticate users, create checkouts, write balances or change a subscription. Missing/stale plans, price differences and disabled paid billing block publication.
4. Run `npm test` and `npm run test:commercial`, review desktop/mobile pricing, and merge only after parity passes.
5. GitHub Pages runs the same parity check before uploading/deploying. Recheck live Pricing and Terms after publication.

Production plan parity does not establish an end-to-end payment or metering test; the endpoint exposes plans, not weights or a subscription's actual ledger. Those require separate backend release validation.
