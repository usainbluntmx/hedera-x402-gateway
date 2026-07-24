# @zero-two-labs/hedera-x402-guard

Spend guardrails and per-agent policies for [x402](https://x402.org) payments
on [Hedera](https://hedera.com). SQLite-backed, framework-agnostic — drop it
in front of any x402 client or resource server to enforce per-transaction
and daily spend limits before a payment is signed.

Built for the Hedera x402 bounty (WeAreDevelopers Berlin, July 2026). Part of
a larger reference gateway: https://github.com/usainbluntmx/hedera-x402-gateway

## Install

\`\`\`bash
npm install @zero-two-labs/hedera-x402-guard
\`\`\`

## Usage

\`\`\`javascript
import { initGuardrailDb, checkSpendLimit, recordSpend, setAgentPolicy } from "@zero-two-labs/hedera-x402-guard";

initGuardrailDb("./data/guardrails.sqlite");

// Optional: give a specific agent its own limits
setAgentPolicy("0.0.9695602", {
  label: "Trading agent",
  maxTxTinybars: 2_000_000,
  maxDailyTinybars: 10_000_000,
});

// Before signing any x402 payment:
const check = checkSpendLimit("0.0.9695602", 1_000_000);
if (!check.allowed) {
  throw new Error(check.reason);
}

// After the payment settles:
recordSpend("0.0.9695602", 1_000_000);
\`\`\`

## API

- `initGuardrailDb(path)` — initializes the SQLite store. Call once at startup.
- `checkSpendLimit(accountId, amountTinybars)` — evaluates a proposed payment
  against the agent's policy (or global defaults). Does not mutate state.
- `recordSpend(accountId, amountTinybars)` — records a settled payment.
- `getSpendStatus(accountId)` — current spend, limits, and remaining budget.
- `setAgentPolicy(accountId, { label, maxTxTinybars, maxDailyTinybars })` —
  registers a custom policy for one agent.
- `getAgentPolicy`, `listAgentPolicies`, `deleteAgentPolicy` — policy management.
- `setGlobalDefaults({ maxTxTinybars, maxDailyTinybars })` — fallback limits
  for agents without a custom policy.

## License

MIT