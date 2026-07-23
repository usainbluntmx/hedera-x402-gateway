# Hedera x402 Payment Gateway with Spend Guardrails

Infrastructure-layer x402 payment gateway for Hedera testnet, combining a
one-line paywall middleware with built-in spend guardrails — designed to be
integrated by other services, not consumed as a standalone app.

## What this is

Most x402 examples show a single paid endpoint. This project is the piece
underneath that: a reusable gateway that (1) turns any Express route into a
pay-per-request endpoint settled on Hedera, and (2) enforces per-transaction
and daily spend limits on the buyer side *before* any payment is signed —
persisted in SQLite so limits survive restarts.

## Architecture

- `src/server/payment.js` — x402 resource server, registered with
  `ExactHederaScheme` on `hedera:testnet`, paid in native HBAR
  (asset `0.0.0`).
- `src/guardrails/spend-guard.js` — spend-limit engine backed by SQLite
  (`src/guardrails/db.js`).
- `src/guardrails/guarded-fetch.js` — client-side wrapper that decodes the
  `PAYMENT-REQUIRED` header, checks the guardrail, and only then lets
  `@x402/fetch` sign and settle the payment.
- `src/server/index.js` — Express app: the protected route
  (`GET /data/example`) plus admin endpoints (`GET /admin/limits`,
  `GET /admin/spend/:accountId`).

## Stack

- `@x402/core`, `@x402/express`, `@x402/hedera`, `@x402/fetch` (x402 v2
  reference SDKs)
- `@hiero-ledger/sdk` for Hedera account/token operations
- `better-sqlite3` for guardrail persistence
- Facilitator: `https://x402.org/facilitator` (official default, supports
  `hedera:testnet` natively)

## Running it

\`\`\`bash
npm install
cp .env.example .env   # fill in your Hedera testnet credentials
npm run dev
\`\`\`

In a second terminal:

\`\`\`bash
node scripts/pay-and-fetch.js
\`\`\`

## On-chain evidence (Hedera testnet)

See [EVIDENCE.md](./EVIDENCE.md) for the full list of real transactions,
including:

- Token association: https://hashscan.io/testnet/transaction/0.0.9692115-1784779292-981637429
- First settled x402 payment: https://hashscan.io/testnet/transaction/0.0.9185802-1784784147-934492557
- Buyer account creation: https://hashscan.io/testnet/transaction/0.0.9692115-1784780865-597032507

## Why this is infrastructure, not an app

The gateway has no opinion about what's behind the paywall — any Express
route can be protected with the same middleware. The guardrail layer is
similarly generic: it keys off buyer account ID, not the specific service
being paid for. A company processing high transaction volume could drop
this in front of any internal API and get both monetization and spend
control in one integration.