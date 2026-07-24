import { db } from "./db.js";
import { config } from "../config/env.js";

const upsertStmt = db.prepare(`
  INSERT INTO agent_policies (account_id, label, max_tx_tinybars, max_daily_tinybars, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'))
  ON CONFLICT(account_id) DO UPDATE SET
    label = excluded.label,
    max_tx_tinybars = excluded.max_tx_tinybars,
    max_daily_tinybars = excluded.max_daily_tinybars,
    updated_at = datetime('now')
`);

const getStmt = db.prepare(`SELECT * FROM agent_policies WHERE account_id = ?`);
const listStmt = db.prepare(`SELECT * FROM agent_policies ORDER BY updated_at DESC`);
const deleteStmt = db.prepare(`DELETE FROM agent_policies WHERE account_id = ?`);

export function setAgentPolicy(accountId, { label, maxTxTinybars, maxDailyTinybars }) {
  upsertStmt.run(accountId, label || null, maxTxTinybars.toString(), maxDailyTinybars.toString());
  return getAgentPolicy(accountId);
}

/**
 * Devuelve la política del agente si existe, o los límites globales
 * del .env como fallback — así un agente sin política propia sigue
 * protegido por los valores por defecto.
 */
export function getAgentPolicy(accountId) {
  const row = getStmt.get(accountId);
  if (row) {
    return {
      accountId: row.account_id,
      label: row.label,
      maxTxTinybars: BigInt(row.max_tx_tinybars),
      maxDailyTinybars: BigInt(row.max_daily_tinybars),
      isCustom: true,
    };
  }
  return {
    accountId,
    label: null,
    maxTxTinybars: config.maxTxTinybars,
    maxDailyTinybars: config.maxDailyTinybars,
    isCustom: false,
  };
}

export function listAgentPolicies() {
  return listStmt.all().map((row) => ({
    accountId: row.account_id,
    label: row.label,
    maxTxTinybars: row.max_tx_tinybars,
    maxDailyTinybars: row.max_daily_tinybars,
    updatedAt: row.updated_at,
  }));
}

export function deleteAgentPolicy(accountId) {
  const result = deleteStmt.run(accountId);
  return result.changes > 0;
}