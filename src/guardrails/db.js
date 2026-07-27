import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/guardrails.sqlite");

import { mkdirSync } from "node:fs";
mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS spend_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    asset_id TEXT NOT NULL DEFAULT '0.0.0',
    day TEXT NOT NULL,
    amount_tinybars TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_spend_account_asset_day
    ON spend_log (account_id, asset_id, day);

  CREATE TABLE IF NOT EXISTS agent_policies (
    account_id TEXT NOT NULL,
    asset_id TEXT NOT NULL DEFAULT '0.0.0',
    label TEXT,
    max_tx_tinybars TEXT NOT NULL,
    max_daily_tinybars TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (account_id, asset_id)
  );
`);