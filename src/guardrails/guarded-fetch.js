import { checkSpendLimit, recordSpend } from "./spend-guard.js";

/**
 * Decodifica el header PAYMENT-REQUIRED (base64 JSON) sin necesidad
 * de las utilidades internas del SDK — mismo formato que ya inspeccionamos a mano.
 */
function decodePaymentRequired(header) {
  const json = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(json);
}

/**
 * Envuelve fetchWithPayment con un guardrail de gasto.
 * Hace un GET "seco" primero para leer el 402 y evaluar el monto
 * ANTES de permitir que fetchWithPayment firme y pague.
 *
 * @param {typeof fetch} fetchWithPayment - fetch ya envuelto con wrapFetchWithPayment
 * @param {string} accountId - cuenta compradora (para el registro de gasto)
 * @param {string} url
 * @param {RequestInit} options
 */
export async function guardedFetch(fetchWithPayment, accountId, url, options = {}) {
  // 1. Request "seco" — sin pagar — solo para leer los requisitos de pago
  const probe = await fetch(url, options);

  if (probe.status !== 402) {
    // El recurso no requiere pago (o ya está fallando por otra razón) — pasa directo
    return probe;
  }

  const header = probe.headers.get("payment-required");
  if (!header) {
    throw new Error("Respuesta 402 sin header PAYMENT-REQUIRED — no se puede evaluar el guardrail");
  }

  const requirements = decodePaymentRequired(header);
  const accepted = requirements.accepts?.[0];
  if (!accepted) {
    throw new Error("No se encontraron opciones de pago en la respuesta 402");
  }

  const check = checkSpendLimit(accountId, accepted.amount);
  if (!check.allowed) {
    throw new Error(`🛑 Guardrail bloqueó el pago: ${check.reason}`);
  }

  console.log(
  `✅ Guardrail aprobó el pago: ${accepted.amount} tinybars (gastado hoy: ${check.spentToday}, proyectado tras este pago: ${check.projected})`,
  );

  // 2. Guardrail aprobó — ahora sí, dejamos que fetchWithPayment pague de verdad
  const response = await fetchWithPayment(url, options);

  if (response.status === 200) {
    recordSpend(accountId, accepted.amount);
  }

  return response;
}