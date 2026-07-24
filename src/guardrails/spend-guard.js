import { config } from "../config/env.js";
import { db } from "./db.js";
import { getAgentPolicy } from "./policies.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const sumStmt = db.prepare(`
  SELECT COALESCE(SUM(CAST(amount_tinybars AS INTEGER)), 0) AS total
  FROM spend_log
  WHERE account_id = ? AND day = ?
`);

const insertStmt = db.prepare(`
  INSERT INTO spend_log (account_id, day, amount_tinybars)
  VALUES (?, ?, ?)
`);

function getSpentToday(accountId) {
  const row = sumStmt.get(accountId, todayKey());
  return BigInt(row.total);
}

export function checkSpendLimit(accountId, amountTinybars) {
  const amount = BigInt(amountTinybars);
  const policy = getAgentPolicy(accountId);

  if (amount > policy.maxTxTinybars) {
    return {
      allowed: false,
      reason: `Monto ${amount} excede el límite por transacción de este agente (${policy.maxTxTinybars} tinybars${policy.isCustom ? ", política personalizada" : ", límite global"})`,
    };
  }

  const spentToday = getSpentToday(accountId);
  const projected = spentToday + amount;

  if (projected > policy.maxDailyTinybars) {
    return {
      allowed: false,
      reason: `Gasto diario proyectado ${projected} excede el límite diario de este agente (${policy.maxDailyTinybars} tinybars${policy.isCustom ? ", política personalizada" : ", límite global"}). Ya gastado hoy: ${spentToday}`,
    };
  }

  return { allowed: true, spentToday, projected, policy };
}

export function recordSpend(accountId, amountTinybars) {
  insertStmt.run(accountId, todayKey(), amountTinybars.toString());
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