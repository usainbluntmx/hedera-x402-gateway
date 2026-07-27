import { checkSpendLimit, recordSpend } from "./spend-guard.js";

function decodePaymentRequired(header) {
  const json = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(json);
}

export async function guardedFetch(fetchWithPayment, accountId, url, options = {}) {
  const probe = await fetch(url, options);

  if (probe.status !== 402) return probe;

  const header = probe.headers.get("payment-required");
  if (!header) throw new Error("Respuesta 402 sin header PAYMENT-REQUIRED");

  const requirements = decodePaymentRequired(header);
  const accepted = requirements.accepts?.[0];
  if (!accepted) throw new Error("No se encontraron opciones de pago en la respuesta 402");

  const check = checkSpendLimit(accountId, accepted.asset, accepted.amount);
  if (!check.allowed) {
    throw new Error(`🛑 Guardrail bloqueó el pago: ${check.reason}`);
  }

  console.log(
    `✅ Guardrail aprobó el pago: ${accepted.amount} unidades de ${accepted.asset} (gastado hoy: ${check.spentToday}, proyectado: ${check.projected})`,
  );

  const response = await fetchWithPayment(url, options);

  if (response.status === 200) {
    recordSpend(accountId, accepted.asset, accepted.amount);
  }

  return response;
}