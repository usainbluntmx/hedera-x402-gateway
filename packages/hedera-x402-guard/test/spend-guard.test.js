import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { initGuardrailDb, getDb } from "../src/db.js";
import { checkSpendLimit, recordSpend, getSpendStatus } from "../src/spend-guard.js";
import { setAgentPolicy, setGlobalDefaults, deleteAgentPolicy } from "../src/policies.js";

const TEST_DB_PATH = "./test/tmp-spend-guard.sqlite";
const HBAR = "0.0.0";
const USDC = "0.0.429274";

before(() => {
  initGuardrailDb(TEST_DB_PATH);
});

after(() => {
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH);
});

beforeEach(() => {
  // Limpia el estado entre tests para que no se contaminen entre sí
  getDb().exec("DELETE FROM spend_log; DELETE FROM agent_policies;");
  setGlobalDefaults(HBAR, { maxTxTinybars: 5_000_000n, maxDailyTinybars: 20_000_000n });
  setGlobalDefaults(USDC, { maxTxTinybars: 500_000n, maxDailyTinybars: 5_000_000n });
});

test("permite un pago dentro de los límites globales", () => {
  const result = checkSpendLimit("0.0.1001", HBAR, 1_000_000);
  assert.equal(result.allowed, true);
  assert.equal(result.spentToday, 0n);
  assert.equal(result.projected, 1_000_000n);
});

test("bloquea un pago que excede el límite por transacción", () => {
  const result = checkSpendLimit("0.0.1001", HBAR, 6_000_000);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /excede el límite por transacción/);
});

test("acumula el gasto diario correctamente tras varios pagos", () => {
  recordSpend("0.0.1002", HBAR, 1_000_000);
  recordSpend("0.0.1002", HBAR, 2_000_000);

  const status = getSpendStatus("0.0.1002", HBAR);
  assert.equal(status.spentToday, "3000000");
  assert.equal(status.remainingToday, "17000000");
});

test("bloquea un pago que excede el límite diario acumulado", () => {
  recordSpend("0.0.1003", HBAR, 19_000_000);

  const result = checkSpendLimit("0.0.1003", HBAR, 2_000_000);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /excede el límite diario/);
});

test("el gasto de una cuenta no afecta el límite de otra", () => {
  recordSpend("0.0.1004", HBAR, 15_000_000);

  const otherAccount = checkSpendLimit("0.0.1005", HBAR, 1_000_000);
  assert.equal(otherAccount.allowed, true);
  assert.equal(otherAccount.spentToday, 0n);
});

test("el gasto en HBAR y USDC de la misma cuenta se acumula de forma independiente", () => {
  recordSpend("0.0.1010", HBAR, 4_000_000);
  recordSpend("0.0.1010", USDC, 100_000);

  const hbarStatus = getSpendStatus("0.0.1010", HBAR);
  const usdcStatus = getSpendStatus("0.0.1010", USDC);

  assert.equal(hbarStatus.spentToday, "4000000");
  assert.equal(usdcStatus.spentToday, "100000", "el gasto en USDC no debe mezclarse con el de HBAR");
});

test("una política personalizada por agente sobrescribe los límites globales", () => {
  setAgentPolicy("0.0.1006", HBAR, {
    label: "Agente restringido",
    maxTxTinybars: 500_000,
    maxDailyTinybars: 1_000_000,
  });

  const result = checkSpendLimit("0.0.1006", HBAR, 800_000);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /excede el límite por transacción/);

  const status = getSpendStatus("0.0.1006", HBAR);
  assert.equal(status.isCustomPolicy, true);
  assert.equal(status.maxPerTx, "500000");
});

test("un agente sin política propia vuelve a usar los límites globales tras eliminarla", () => {
  setAgentPolicy("0.0.1007", HBAR, { maxTxTinybars: 100_000, maxDailyTinybars: 200_000 });
  deleteAgentPolicy("0.0.1007", HBAR);

  const status = getSpendStatus("0.0.1007", HBAR);
  assert.equal(status.isCustomPolicy, false);
  assert.equal(status.maxPerTx, "5000000");
});

test("rechaza un monto igual al límite exacto por transacción (caso límite)", () => {
  const exact = checkSpendLimit("0.0.1008", HBAR, 5_000_000);
  assert.equal(exact.allowed, true);

  const overByOne = checkSpendLimit("0.0.1009", HBAR, 5_000_001);
  assert.equal(overByOne.allowed, false);
});