import Database from "better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";

let dbInstance;

/**
 * Inicializa (o reutiliza) la base de datos SQLite del guardrail.
 * Debe llamarse una vez, antes de usar cualquier otra función del paquete.
 *
 * @param {string} dbPath - Ruta del archivo SQLite (ej. "./data/guardrails.sqlite")
 */
export function initGuardrailDb(dbPath = "./guardrails.sqlite") {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  dbInstance = new Database(dbPath);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS spend_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      day TEXT NOT NULL,
      amount_tinybars TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_spend_account_day ON spend_log (account_id, day);

    CREATE TABLE IF NOT EXISTS agent_policies (
      account_id TEXT PRIMARY KEY,
      label TEXT,
      max_tx_tinybars TEXT NOT NULL,
      max_daily_tinybars TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    throw new Error("Guardrail DB no inicializada — llama initGuardrailDb() primero.");
  }
  return dbInstance;
}