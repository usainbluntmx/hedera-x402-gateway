import { recordSpend } from "./spend-guard.js";
import { attestPayment } from "./attestation.js";

const HBAR_ASSET_ID = "0.0.0"; // este tracker solo maneja schedules de HBAR nativo

// Registro en memoria de schedules pendientes de confirmar
const pendingSchedules = new Map(); // scheduleId -> { buyerAccountId, amountTinybars }

export function trackSchedule(scheduleId, buyerAccountId, amountTinybars) {
  pendingSchedules.set(scheduleId, { buyerAccountId, amountTinybars, confirmed: false });
}

/**
 * Revisa los schedules pendientes contra el Mirror Node. Si ya se ejecutaron,
 * registra el gasto y dispara la atestación en HCS — cerrando el ciclo
 * completo aunque nadie haya estado presente cuando ocurrió el pago.
 */
export async function pollPendingSchedules() {
  for (const [scheduleId, info] of pendingSchedules.entries()) {
    if (info.confirmed) continue;

    const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/schedules/${scheduleId}`);
    if (!res.ok) continue;
    const data = await res.json();

    if (data.executed_timestamp) {
      recordSpend(info.buyerAccountId, HBAR_ASSET_ID, info.amountTinybars);
      info.confirmed = true;

      console.log(`✅ Schedule ${scheduleId} confirmado ejecutado — gasto registrado`);

      attestPayment({
        route: "/schedule-payment",
        payer: info.buyerAccountId,
        amount: info.amountTinybars,
        asset: HBAR_ASSET_ID,
        transactionId: data.transaction_id,
      });
    }
  }
}

export function startScheduleTracker(intervalMs = 15000) {
  setInterval(pollPendingSchedules, intervalMs);
}