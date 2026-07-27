import { getDb } from "./db.js";
import { getAgentPolicy } from "./policies.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getSpentToday(accountId, assetId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(SUM(CAST(amount_tinybars AS INTEGER)), 0) AS total
    FROM spend_log
    WHERE account_id = ? AND asset_id = ? AND day = ?
  `).get(accountId, assetId, todayKey());
  return BigInt(row.total);
}

export function checkSpendLimit(accountId, assetId, amountTinybars) {
  const amount = BigInt(amountTinybars);
  const policy = getAgentPolicy(accountId, assetId);

  if (amount > policy.maxTxTinybars) {
    return {
      allowed: false,
      reason: `Monto ${amount} excede el límite por transacción para el asset ${assetId} (${policy.maxTxTinybars})`,
    };
  }

  const spentToday = getSpentToday(accountId, assetId);
  const projected = spentToday + amount;

  if (projected > policy.maxDailyTinybars) {
    return {
      allowed: false,
      reason: `Gasto diario proyectado ${projected} excede el límite diario para el asset ${assetId} (${policy.maxDailyTinybars}). Ya gastado hoy: ${spentToday}`,
    };
  }

  return { allowed: true, spentToday, projected, policy };
}

export function recordSpend(accountId, assetId, amountTinybars) {
  const db = getDb();
  db.prepare(`
    INSERT INTO spend_log (account_id, asset_id, day, amount_tinybars)
    VALUES (?, ?, ?, ?)
  `).run(accountId, assetId, todayKey(), amountTinybars.toString());
}

export function getSpendStatus(accountId, assetId) {
  const spentToday = getSpentToday(accountId, assetId);
  const policy = getAgentPolicy(accountId, assetId);

  return {
    accountId,
    assetId,
    label: policy.label,
    isCustomPolicy: policy.isCustom,
    spentToday: spentToday.toString(),
    maxDaily: policy.maxDailyTinybars.toString(),
    maxPerTx: policy.maxTxTinybars.toString(),
    remainingToday: (policy.maxDailyTinybars - spentToday).toString(),
  };
}