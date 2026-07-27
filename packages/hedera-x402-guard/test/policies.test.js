import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { initGuardrailDb, getDb } from "../src/db.js";
import {
  setAgentPolicy,
  getAgentPolicy,
  listAgentPolicies,
  deleteAgentPolicy,
  setGlobalDefaults,
} from "../src/policies.js";

const TEST_DB_PATH = "./test/tmp-policies.sqlite";
const HBAR = "0.0.0";
const USDC = "0.0.429274";

before(() => {
  initGuardrailDb(TEST_DB_PATH);
});

after(() => {
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH);
});

beforeEach(() => {
  getDb().exec("DELETE FROM agent_policies;");
  setGlobalDefaults(HBAR, { maxTxTinybars: 5_000_000n, maxDailyTinybars: 20_000_000n });
  setGlobalDefaults(USDC, { maxTxTinybars: 500_000n, maxDailyTinybars: 5_000_000n });
});

test("getAgentPolicy devuelve los defaults globales del asset si no hay política registrada", () => {
  const policy = getAgentPolicy("0.0.2001", HBAR);
  assert.equal(policy.isCustom, false);
  assert.equal(policy.maxTxTinybars, 5_000_000n);
});

test("getAgentPolicy usa los defaults correctos según el asset consultado", () => {
  const hbarPolicy = getAgentPolicy("0.0.2001", HBAR);
  const usdcPolicy = getAgentPolicy("0.0.2001", USDC);

  assert.equal(hbarPolicy.maxTxTinybars, 5_000_000n);
  assert.equal(usdcPolicy.maxTxTinybars, 500_000n);
});

test("setAgentPolicy crea una política nueva correctamente", () => {
  const policy = setAgentPolicy("0.0.2002", HBAR, {
    label: "Trading bot",
    maxTxTinybars: 1_000_000,
    maxDailyTinybars: 5_000_000,
  });

  assert.equal(policy.isCustom, true);
  assert.equal(policy.label, "Trading bot");
  assert.equal(policy.maxTxTinybars, 1_000_000n);
});

test("setAgentPolicy sobre una cuenta existente actualiza en vez de duplicar", () => {
  setAgentPolicy("0.0.2003", HBAR, { label: "v1", maxTxTinybars: 100, maxDailyTinybars: 200 });
  setAgentPolicy("0.0.2003", HBAR, { label: "v2", maxTxTinybars: 999, maxDailyTinybars: 999 });

  const all = listAgentPolicies();
  const matches = all.filter((p) => p.account_id === "0.0.2003" && p.asset_id === HBAR);

  assert.equal(matches.length, 1, "no debe haber políticas duplicadas para la misma cuenta y asset");
  assert.equal(matches[0].label, "v2");
});

test("una cuenta puede tener políticas distintas e independientes para HBAR y USDC", () => {
  setAgentPolicy("0.0.2005", HBAR, { label: "límite HBAR", maxTxTinybars: 100, maxDailyTinybars: 200 });
  setAgentPolicy("0.0.2005", USDC, { label: "límite USDC", maxTxTinybars: 999, maxDailyTinybars: 999 });

  const all = listAgentPolicies();
  const matches = all.filter((p) => p.account_id === "0.0.2005");

  assert.equal(matches.length, 2, "debe haber dos políticas separadas, una por asset");
});

test("deleteAgentPolicy elimina la política y libera la cuenta para ese asset", () => {
  setAgentPolicy("0.0.2004", HBAR, { maxTxTinybars: 1, maxDailyTinybars: 1 });
  const deleted = deleteAgentPolicy("0.0.2004", HBAR);

  assert.equal(deleted, true);
  assert.equal(getAgentPolicy("0.0.2004", HBAR).isCustom, false);
});

test("deleteAgentPolicy sobre una cuenta inexistente devuelve false sin lanzar error", () => {
  const deleted = deleteAgentPolicy("0.0.9999999", HBAR);
  assert.equal(deleted, false);
});