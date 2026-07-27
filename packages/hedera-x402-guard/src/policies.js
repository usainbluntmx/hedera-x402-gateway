import { getDb } from "./db.js";

let globalDefaults = { maxTxTinybars: 5000000n, maxDailyTinybars: 20000000n };

/**
 * Define los límites globales usados como fallback para agentes sin
 * política propia, para un asset específico. Opcional — si no se llama
 * para un asset dado, ese asset usa 5M/20M como default genérico.
 */
export function setGlobalDefaults(assetId, { maxTxTinybars, maxDailyTinybars }) {
  if (typeof assetId === "object") {
    // Compatibilidad con la firma anterior (sin assetId): trata como HBAR.
    globalDefaults = {
      ...globalDefaults,
      "0.0.0": { maxTxTinybars: BigInt(assetId.maxTxTinybars), maxDailyTinybars: BigInt(assetId.maxDailyTinybars) },
    };
    return;
  }
  globalDefaults = {
    ...globalDefaults,
    [assetId]: { maxTxTinybars: BigInt(maxTxTinybars), maxDailyTinybars: BigInt(maxDailyTinybars) },
  };
}

function globalDefaultsFor(assetId) {
  return globalDefaults[assetId] || { maxTxTinybars: 5000000n, maxDailyTinybars: 20000000n };
}

export function setAgentPolicy(accountId, assetId, { label, maxTxTinybars, maxDailyTinybars }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_policies (account_id, asset_id, label, max_tx_tinybars, max_daily_tinybars, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(account_id, asset_id) DO UPDATE SET
      label = excluded.label,
      max_tx_tinybars = excluded.max_tx_tinybars,
      max_daily_tinybars = excluded.max_daily_tinybars,
      updated_at = datetime('now')
  `).run(accountId, assetId, label || null, maxTxTinybars.toString(), maxDailyTinybars.toString());
  return getAgentPolicy(accountId, assetId);
}

export function getAgentPolicy(accountId, assetId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM agent_policies WHERE account_id = ? AND asset_id = ?`).get(accountId, assetId);
  if (row) {
    return {
      accountId: row.account_id,
      assetId: row.asset_id,
      label: row.label,
      maxTxTinybars: BigInt(row.max_tx_tinybars),
      maxDailyTinybars: BigInt(row.max_daily_tinybars),
      isCustom: true,
    };
  }
  const defaults = globalDefaultsFor(assetId);
  return {
    accountId,
    assetId,
    label: null,
    maxTxTinybars: defaults.maxTxTinybars,
    maxDailyTinybars: defaults.maxDailyTinybars,
    isCustom: false,
  };
}

export function listAgentPolicies() {
  const db = getDb();
  return db.prepare(`SELECT * FROM agent_policies ORDER BY updated_at DESC`).all();
}

export function deleteAgentPolicy(accountId, assetId) {
  const db = getDb();
  return db.prepare(`DELETE FROM agent_policies WHERE account_id = ? AND asset_id = ?`).run(accountId, assetId).changes > 0;
}