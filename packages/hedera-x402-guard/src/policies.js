import { getDb } from "./db.js";

let globalDefaults = { maxTxTinybars: 5000000n, maxDailyTinybars: 20000000n };

/**
 * Define los límites globales usados como fallback para agentes sin
 * política propia. Opcional — si no se llama, usa 5M/20M tinybars.
 */
export function setGlobalDefaults({ maxTxTinybars, maxDailyTinybars }) {
  globalDefaults = { maxTxTinybars: BigInt(maxTxTinybars), maxDailyTinybars: BigInt(maxDailyTinybars) };
}

export function setAgentPolicy(accountId, { label, maxTxTinybars, maxDailyTinybars }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_policies (account_id, label, max_tx_tinybars, max_daily_tinybars, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(account_id) DO UPDATE SET
      label = excluded.label, max_tx_tinybars = excluded.max_tx_tinybars,
      max_daily_tinybars = excluded.max_daily_tinybars, updated_at = datetime('now')
  `).run(accountId, label || null, maxTxTinybars.toString(), maxDailyTinybars.toString());
  return getAgentPolicy(accountId);
}

export function getAgentPolicy(accountId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM agent_policies WHERE account_id = ?`).get(accountId);
  if (row) {
    return {
      accountId: row.account_id,
      label: row.label,
      maxTxTinybars: BigInt(row.max_tx_tinybars),
      maxDailyTinybars: BigInt(row.max_daily_tinybars),
      isCustom: true,
    };
  }
  return { accountId, label: null, ...globalDefaults, isCustom: false };
}

export function listAgentPolicies() {
  const db = getDb();
  return db.prepare(`SELECT * FROM agent_policies ORDER BY updated_at DESC`).all();
}

export function deleteAgentPolicy(accountId) {
  const db = getDb();
  return db.prepare(`DELETE FROM agent_policies WHERE account_id = ?`).run(accountId).changes > 0;
}