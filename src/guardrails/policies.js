import { db } from "./db.js";
import { config } from "../config/env.js";

const upsertStmt = db.prepare(`
  INSERT INTO agent_policies (account_id, asset_id, label, max_tx_tinybars, max_daily_tinybars, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(account_id, asset_id) DO UPDATE SET
    label = excluded.label,
    max_tx_tinybars = excluded.max_tx_tinybars,
    max_daily_tinybars = excluded.max_daily_tinybars,
    updated_at = datetime('now')
`);

const getStmt = db.prepare(`SELECT * FROM agent_policies WHERE account_id = ? AND asset_id = ?`);
const listStmt = db.prepare(`SELECT * FROM agent_policies ORDER BY updated_at DESC`);
const deleteStmt = db.prepare(`DELETE FROM agent_policies WHERE account_id = ? AND asset_id = ?`);

export function setAgentPolicy(accountId, assetId, { label, maxTxTinybars, maxDailyTinybars }) {
  upsertStmt.run(accountId, assetId, label || null, maxTxTinybars.toString(), maxDailyTinybars.toString());
  return getAgentPolicy(accountId, assetId);
}

function globalDefaultsFor(assetId) {
  return config.assetDefaults[assetId] || config.assetDefaults["0.0.0"];
}

export function getAgentPolicy(accountId, assetId) {
  const row = getStmt.get(accountId, assetId);
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
    maxTxTinybars: defaults.maxTx,
    maxDailyTinybars: defaults.maxDaily,
    isCustom: false,
  };
}

export function listAgentPolicies() {
  return listStmt.all();
}

export function deleteAgentPolicy(accountId, assetId) {
  return deleteStmt.run(accountId, assetId).changes > 0;
}