# @zero-two-labs/hedera-x402-guard

Spend guardrails and per-agent, per-asset policies for [x402](https://x402.org) payments
on [Hedera](https://hedera.com). SQLite-backed, framework-agnostic — drop it
in front of any x402 client or resource server to enforce per-transaction
and daily spend limits, tracked independently per settlement asset (HBAR,
USDC, or any other Hedera token), before a payment is signed.

Built as part of the Hedera x402 Gateway reference implementation:
https://github.com/usainbluntmx/hedera-x402-gateway

## Install

```bash
npm install @zero-two-labs/hedera-x402-guard
```

## Usage

```javascript
import { initGuardrailDb, checkSpendLimit, recordSpend, setAgentPolicy, setGlobalDefaults } from "@zero-two-labs/hedera-x402-guard";

initGuardrailDb("./data/guardrails.sqlite");

const HBAR = "0.0.0";
const USDC_TESTNET = "0.0.429274";

// Optional: set global default limits per asset (used when an agent has no custom policy)
setGlobalDefaults(HBAR, { maxTxTinybars: 5_000_000, maxDailyTinybars: 20_000_000 });
setGlobalDefaults(USDC_TESTNET, { maxTxTinybars: 500_000, maxDailyTinybars: 5_000_000 });

// Optional: give a specific agent its own limits, per asset
setAgentPolicy("0.0.9695602", HBAR, {
  label: "Trading agent",
  maxTxTinybars: 2_000_000,
  maxDailyTinybars: 10_000_000,
});

// Before signing any x402 payment:
const check = checkSpendLimit("0.0.9695602", HBAR, 1_000_000);
if (!check.allowed) {
  throw new Error(check.reason);
}

// After the payment settles:
recordSpend("0.0.9695602", HBAR, 1_000_000);
```

## API

- `initGuardrailDb(path)` — initializes the SQLite store. Call once at startup.
- `checkSpendLimit(accountId, assetId, amount)` — evaluates a proposed payment
  against the agent's policy for that asset (or the global default for that
  asset). Does not mutate state.
- `recordSpend(accountId, assetId, amount)` — records a settled payment.
- `getSpendStatus(accountId, assetId)` — current spend, limits, and remaining
  budget for that account and asset.
- `setAgentPolicy(accountId, assetId, { label, maxTxTinybars, maxDailyTinybars })` —
  registers a custom policy for one agent, scoped to one asset.
- `getAgentPolicy`, `listAgentPolicies`, `deleteAgentPolicy(accountId, assetId)` —
  policy management.
- `setGlobalDefaults(assetId, { maxTxTinybars, maxDailyTinybars })` — fallback
  limits for agents without a custom policy, per asset.

> **Migrating from 0.1.x:** every function that took `(accountId, ...)` now
> takes `(accountId, assetId, ...)`. Pass `"0.0.0"` as `assetId` to preserve
> the old HBAR-only behavior. `setGlobalDefaults({ maxTxTinybars, maxDailyTinybars })`
> without an `assetId` still works and is treated as HBAR, for backward
> compatibility — but the two-argument form (`setGlobalDefaults(assetId, {...})`)
> is preferred going forward.

## License

MIT