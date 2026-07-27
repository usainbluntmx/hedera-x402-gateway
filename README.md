# Hedera x402 Payment Gateway with Spend Guardrails

Infrastructure-layer x402 payment gateway for Hedera, combining a
one-line paywall middleware with built-in spend guardrails — designed to be
integrated by other services, not consumed as a standalone app.

## What this is

Most x402 examples show a single paid endpoint. This project is the piece
underneath that: a reusable gateway that (1) turns any Express route into a
pay-per-request endpoint settled on Hedera in either native HBAR or USDC,
and (2) enforces per-transaction and daily spend limits **per asset** on
the buyer side *before* any payment is signed — persisted in SQLite so
limits survive restarts.

## Architecture

- `src/server/payment.js` — x402 resource server, registered with
  `ExactHederaScheme` on `hedera:testnet`. Three routes ship by default:
  two priced in native HBAR (asset `0.0.0`) and one priced in USDC testnet
  (asset `0.0.429274`).
- `src/guardrails/assets.js` — per-asset metadata (symbol, decimals) and a
  cached HBAR/USD price lookup, used to convert atomic amounts into
  human-readable figures.
- `src/guardrails/spend-guard.js` — spend-limit engine backed by SQLite
  (`src/guardrails/db.js`). Limits are tracked independently per
  `(account, asset)` pair — a HBAR limit never competes with a USDC limit.
- `src/guardrails/guarded-fetch.js` — client-side wrapper that decodes the
  `PAYMENT-REQUIRED` header, checks the guardrail for the asset being
  requested, and only then lets `@x402/fetch` sign and settle the payment.
- `src/guardrails/attestation.js` — writes an immutable HCS message for
  every settled payment (topic `0.0.9696800` on testnet).
- `src/guardrails/scheduler.js` / `schedule-tracker.js` — pre-authorized
  (Scheduled Transaction) payments in HBAR, with autonomous execution
  tracking.
- `src/server/index.js` — Express app: three protected routes
  (`GET /data/example`, `GET /data/premium` in HBAR; `GET /data/example-usdc`
  in USDC) proving the same middleware reuses across endpoints and assets,
  plus admin endpoints (`GET /admin/limits`, `GET /admin/spend/:accountId`,
  `GET /admin/policies`, `GET /admin/dashboard-data` — all accept an
  `?asset=` query parameter).
- `public/dashboard.html` — live-refreshing dashboard (polls
  `/admin/dashboard-data` every 3s) showing spend, recent payments, and
  HCS attestations with direct HashScan links, broken out separately for
  HBAR and USDC.
- `docs/index.html` — the project's landing page (served via GitHub Pages).

> **Note on the Mirror Node `payer_account_id`:** x402's Hedera exact
> scheme uses a facilitator-sponsored fee model — the facilitator account
> appears as the Hedera transaction payer (covering network fees), while
> the actual buyer/seller transfer is visible in the transaction's
> token/hbar transfer list. This is protocol behavior, not
> gateway-specific.

## Stack

- `@x402/core`, `@x402/express`, `@x402/hedera`, `@x402/fetch` (x402 v2
  reference SDKs)
- `@hiero-ledger/sdk` for Hedera account/token operations
- `better-sqlite3` for guardrail persistence
- Facilitator: `https://x402.org/facilitator` (official default, supports
  `hedera:testnet` natively)

## Running it

```bash
npm install
cp .env.example .env   # fill in your Hedera testnet credentials
npm run dev
```

In a second terminal, try any of the three payment flows:

```bash
node scripts/pay-and-fetch.js   # HBAR, /data/example
node scripts/pay-premium.js     # HBAR, /data/premium
node scripts/pay-usdc.js        # USDC, /data/example-usdc
```

> **Note:** Guardrail state (spend history, agent policies) persists in
> `data/guardrails.sqlite` across runs, tracked separately per asset. If
> you set a restrictive custom policy while testing, remember it stays
> active for that account and asset — use
> `DELETE /admin/policies/:accountId?asset=<assetId>` to reset it, or
> delete `data/guardrails.sqlite` to start clean.

## Paying in USDC

To pay in USDC testnet (`0.0.429274`), both the buyer and seller accounts
must first be associated with the token, and the buyer needs a real USDC
testnet balance — get one for free from
[Circle's public faucet](https://faucet.circle.com/) (select **Hedera
Testnet**, paste your Hedera Account ID). See `scripts/associate-token-buyer.js`
for the association step.

## On-chain evidence (Hedera testnet)

See [EVIDENCE.md](./EVIDENCE.md) for the full list of real transactions,
including:

- Token association: https://hashscan.io/testnet/transaction/0.0.9692115-1784779292-981637429
- First settled x402 payment: https://hashscan.io/testnet/transaction/0.0.9185802-1784784147-934492557
- Buyer account creation: https://hashscan.io/testnet/transaction/0.0.9692115-1784780865-597032507

## Live dashboard

Run the server and open `http://localhost:4021/dashboard.html` — it polls
the gateway every 3 seconds and shows live spend against the configured
guardrail for both HBAR and USDC, recent on-chain payments, and HCS
attestations, each linking directly to HashScan. HBAR amounts also show
an approximate USD value using a cached CoinGecko price lookup.

## Published as a package

The guardrail engine (spend limits + per-agent, per-asset policies) is
also published as a standalone, framework-agnostic npm package:

**https://www.npmjs.com/package/@zero-two-labs/hedera-x402-guard**

```bash
npm install @zero-two-labs/hedera-x402-guard
```

This is the core claim of this project: it's not a demo app, it's an
installable piece of infrastructure that any x402-on-Hedera integration
can drop in.

## Pre-authorized payments (Hedera Scheduled Transactions)

Agents can pre-authorize a future HBAR payment in a single call via
`POST /schedule-payment` — Hedera's native Scheduled Transactions execute
it automatically when it comes due, with no signer online at execution
time. A background poller detects execution via the Mirror Node and
records the spend + HCS attestation retroactively.

## Per-agent, per-asset spend policies

`POST /admin/policies/:accountId` registers a custom per-transaction and
daily limit for a specific buyer account **and asset** (pass `assetId` in
the body), falling back to global per-asset defaults for any agent
without one — `GET /admin/policies` lists them all.

## Payment attestation (HCS)

Every settled payment triggers a message to a dedicated HCS topic
(`0.0.9696800` on testnet), independently verifiable via the Hedera Mirror
Node or HashScan — a public, immutable audit log decoupled from this
server's own logs.

## Why this is infrastructure, not an app

The gateway has no opinion about what's behind the paywall — any Express
route can be protected with the same middleware, in either settlement
asset. The guardrail layer is similarly generic: it keys off buyer account
ID and asset, not the specific service being paid for. A company
processing high transaction volume could drop this in front of any
internal API and get monetization, multi-asset support, and spend control
in one integration.