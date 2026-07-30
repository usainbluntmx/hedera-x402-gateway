import { recordSpend } from "./spend-guard.js";
import { attestPayment } from "./attestation.js";

const HBAR_ASSET_ID = "0.0.0"; // this tracker only handles native HBAR schedules

// In-memory registry of schedules pending confirmation
const pendingSchedules = new Map(); // scheduleId -> { buyerAccountId, amountTinybars }

export function trackSchedule(scheduleId, buyerAccountId, amountTinybars) {
  pendingSchedules.set(scheduleId, { buyerAccountId, amountTinybars, confirmed: false });
}

/**
 * Checks pending schedules against the Mirror Node. If one has executed,
 * records the spend and triggers the HCS attestation — closing the full
 * loop even though no one was present when the payment happened.
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

      console.log(`✅ Schedule ${scheduleId} confirmed executed — spend recorded`);

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