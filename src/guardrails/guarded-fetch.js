import { checkSpendLimit, recordSpend } from "./spend-guard.js";

function decodePaymentRequired(header) {
  const json = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(json);
}

export async function guardedFetch(fetchWithPayment, accountId, url, options = {}) {
  const probe = await fetch(url, options);

  if (probe.status !== 402) return probe;

  const header = probe.headers.get("payment-required");
  if (!header) throw new Error("402 response missing PAYMENT-REQUIRED header");

  const requirements = decodePaymentRequired(header);
  const accepted = requirements.accepts?.[0];
  if (!accepted) throw new Error("No payment options found in the 402 response");

  const check = checkSpendLimit(accountId, accepted.asset, accepted.amount);
  if (!check.allowed) {
    throw new Error(`🛑 Guardrail blocked the payment: ${check.reason}`);
  }

  console.log(
    `✅ Guardrail approved the payment: ${accepted.amount} units of ${accepted.asset} (spent today: ${check.spentToday}, projected: ${check.projected})`,
  );

  const response = await fetchWithPayment(url, options);

  if (response.status === 200) {
    recordSpend(accountId, accepted.asset, accepted.amount);
  }

  return response;
}