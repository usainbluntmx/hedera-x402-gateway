import express from "express";
import { paymentMiddleware } from "@x402/express";
import { config } from "../config/env.js";
import { resourceServer, dataRouteConfig, premiumRouteConfig } from "./payment.js";
import { getSpendStatus } from "../guardrails/spend-guard.js";
import { attestPayment } from "../guardrails/attestation.js";
import { scheduleAgentPayment } from "../guardrails/scheduler.js";
import { trackSchedule, startScheduleTracker } from "../guardrails/schedule-tracker.js";
import { setAgentPolicy, listAgentPolicies, deleteAgentPolicy } from "../guardrails/policies.js";

const app = express();
app.use(express.json());

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../../public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", account: config.hederaAccountId, network: config.hederaNetwork });
});

// Ahora protegido: sin pago responde 402, con pago responde 200
app.use(
  paymentMiddleware(
    {
      "GET /data/example": dataRouteConfig,
      "GET /data/premium": premiumRouteConfig,
    },
    resourceServer,
  ),
);

app.get("/data/example", (req, res) => {
  const responseBody = {
    message: "Pagaste por esto vía x402 en Hedera testnet 🎉",
    timestamp: new Date().toISOString(),
  };

  res.json(responseBody);

  // El header payment-response lo agrega el middleware DESPUÉS de que el
  // handler termina (liquidación post-respuesta), así que esperamos al
  // evento "finish" para leerlo con certeza de que ya está presente.
  res.on("finish", () => {
    const paymentResponseHeader = res.getHeader("payment-response");
    if (!paymentResponseHeader) return;

    const decoded = JSON.parse(
      Buffer.from(paymentResponseHeader.toString(), "base64").toString("utf-8"),
    );

    attestPayment({
      route: "/data/example",
      payer: decoded.payer,
      amount: dataRouteConfig.accepts[0].price.amount,
      asset: dataRouteConfig.accepts[0].price.asset,
      transactionId: decoded.transaction,
    });
  });
});

app.get("/data/premium", (req, res) => {
  const responseBody = {
    message: "Acceso premium desbloqueado vía x402 — dataset extendido 🎉",
    dataset: { points: 1000, resolution: "high", generatedAt: new Date().toISOString() },
  };

  res.json(responseBody);

  res.on("finish", () => {
    const paymentResponseHeader = res.getHeader("payment-response");
    if (!paymentResponseHeader) return;

    const decoded = JSON.parse(
      Buffer.from(paymentResponseHeader.toString(), "base64").toString("utf-8"),
    );

    attestPayment({
      route: "/data/premium",
      payer: decoded.payer,
      amount: premiumRouteConfig.accepts[0].price.amount,
      asset: premiumRouteConfig.accepts[0].price.asset,
      transactionId: decoded.transaction,
    });
  });
});

// Consultar el estado de gasto de una cuenta compradora específica
app.get("/admin/spend/:accountId", (req, res) => {
  const status = getSpendStatus(req.params.accountId);
  res.json(status);
});

// Consultar los límites globales configurados
app.get("/admin/limits", (req, res) => {
  res.json({
    maxTxTinybars: config.maxTxTinybars.toString(),
    maxDailyTinybars: config.maxDailyTinybars.toString(),
  });
});

app.get("/admin/dashboard-data", async (req, res) => {
  const buyerAccountId = req.query.account || process.env.BUYER_ACCOUNT_ID;
  const spend = getSpendStatus(buyerAccountId);

  // Últimos pagos, directo del Mirror Node (fuente pública verificable)
  const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=${config.hederaAccountId}&transactiontype=CRYPTOTRANSFER&limit=5&order=desc`;
  const mirrorRes = await fetch(mirrorUrl);
  const mirrorData = await mirrorRes.json();

  const recentPayments = mirrorData.transactions.map((tx) => ({
    transactionId: tx.transaction_id,
    result: tx.result,
    timestamp: tx.consensus_timestamp,
    hashscanUrl: `https://hashscan.io/testnet/transaction/${tx.transaction_id}`,
  }));

  // Últimas atestaciones en HCS
  const hcsUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${config.hcsTopicId}/messages?limit=5&order=desc`;
  const hcsRes = await fetch(hcsUrl);
  const hcsData = await hcsRes.json();

  const attestations = hcsData.messages.map((m) => ({
    sequenceNumber: m.sequence_number,
    timestamp: m.consensus_timestamp,
    decoded: JSON.parse(Buffer.from(m.message, "base64").toString("utf-8")),
    hashscanUrl: `https://hashscan.io/testnet/topic/${config.hcsTopicId}`,
  }));

  res.json({
    limits: {
      maxTxTinybars: config.maxTxTinybars.toString(),
      maxDailyTinybars: config.maxDailyTinybars.toString(),
    },
    spend,
    recentPayments,
    attestations,
    hcsTopicId: config.hcsTopicId,
  });
});

// Crear o actualizar la política de un agente específico
app.post("/admin/policies/:accountId", express.json(), (req, res) => {
  const { label, maxTxTinybars, maxDailyTinybars } = req.body;

  if (!maxTxTinybars || !maxDailyTinybars) {
    return res.status(400).json({ error: "Faltan campos: maxTxTinybars, maxDailyTinybars" });
  }

  const policy = setAgentPolicy(req.params.accountId, { label, maxTxTinybars, maxDailyTinybars });
  res.json({
    ...policy,
    maxTxTinybars: policy.maxTxTinybars.toString(),
    maxDailyTinybars: policy.maxDailyTinybars.toString(),
  });
});

// Listar todas las políticas personalizadas registradas
app.get("/admin/policies", (req, res) => {
  res.json(listAgentPolicies());
});

// Eliminar la política de un agente (vuelve a usar los límites globales)
app.delete("/admin/policies/:accountId", (req, res) => {
  const deleted = deleteAgentPolicy(req.params.accountId);
  res.json({ deleted });
});

// El comprador pre-autoriza un pago futuro — el guardrail se evalúa aquí,
// no en el momento de ejecución (que ocurre sin intervención humana).
app.post("/schedule-payment", express.json(), async (req, res) => {
  const { buyerAccountId, buyerPrivateKey, amountTinybars, delayMinutes, memo } = req.body;

  if (!buyerAccountId || !buyerPrivateKey || !amountTinybars || !delayMinutes) {
    return res.status(400).json({
      error: "Faltan campos: buyerAccountId, buyerPrivateKey, amountTinybars, delayMinutes",
    });
  }

  try {
    const result = await scheduleAgentPayment({
      buyerAccountId,
      buyerPrivateKey,
      amountTinybars,
      delayMinutes,
      memo,
    });
    trackSchedule(result.scheduleId, buyerAccountId, amountTinybars);
    res.json(result);
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

startScheduleTracker();

app.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
});