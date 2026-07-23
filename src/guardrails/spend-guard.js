import { config } from "../config/env.js";
import { db } from "./db.js";

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

  if (amount > config.maxTxTinybars) {
    return {
      allowed: false,
      reason: `Monto ${amount} excede el límite por transacción (${config.maxTxTinybars} tinybars)`,
    };
  }

  const spentToday = getSpentToday(accountId);
  const projected = spentToday + amount;

  if (projected > config.maxDailyTinybars) {
    return {
      allowed: false,
      reason: `Gasto diario proyectado ${projected} excede el límite diario (${config.maxDailyTinybars} tinybars). Ya gastado hoy: ${spentToday}`,
    };
  }

  return { allowed: true, spentToday, projected };
}

export function recordSpend(accountId, amountTinybars) {
  insertStmt.run(accountId, todayKey(), amountTinybars.toString());
}

export function getSpendStatus(accountId) {
  const spentToday = getSpentToday(accountId);

  return {
    accountId,
    spentToday: spentToday.toString(),
    maxDaily: config.maxDailyTinybars.toString(),
    maxPerTx: config.maxTxTinybars.toString(),
    remainingToday: (config.maxDailyTinybars - spentToday).toString(),
  };
}