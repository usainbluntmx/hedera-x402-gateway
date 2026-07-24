import { getDb } from "./db.js";
import { getAgentPolicy } from "./policies.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getSpentToday(accountId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(SUM(CAST(amount_tinybars AS INTEGER)), 0) AS total
    FROM spend_log WHERE account_id = ? AND day = ?
  `).get(accountId, todayKey());
  return BigInt(row.total);
}

export function checkSpendLimit(accountId, amountTinybars) {
  const amount = BigInt(amountTinybars);
  const policy = getAgentPolicy(accountId);

  if (amount > policy.maxTxTinybars) {
    return { allowed: false, reason: `Monto ${amount} excede el límite por transacción (${policy.maxTxTinybars} tinybars)` };
  }

  const spentToday = getSpentToday(accountId);
  const projected = spentToday + amount;

  if (projected > policy.maxDailyTinybars) {
    return { allowed: false, reason: `Gasto diario proyectado ${projected} excede el límite diario (${policy.maxDailyTinybars} tinybars)` };
  }

  return { allowed: true, spentToday, projected, policy };
}

export function recordSpend(accountId, amountTinybars) {
  const db = getDb();
  db.prepare(`INSERT INTO spend_log (account_id, day, amount_tinybars) VALUES (?, ?, ?)`)
    .run(accountId, todayKey(), amountTinybars.toString());
}

export function getSpendStatus(accountId) {
  const spentToday = getSpentToday(accountId);
  const policy = getAgentPolicy(accountId);
  return {
    accountId,
    label: policy.label,
    isCustomPolicy: policy.isCustom,
    spentToday: spentToday.toString(),
    maxDaily: policy.maxDailyTinybars.toString(),
    maxPerTx: policy.maxTxTinybars.toString(),
    remainingToday: (policy.maxDailyTinybars - spentToday).toString(),
  };
}