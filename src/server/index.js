import express from "express";
import { paymentMiddleware } from "@x402/express";
import { config } from "../config/env.js";
import { resourceServer, dataRouteConfig, premiumRouteConfig, usdcRouteConfig } from "./payment.js";
import { getSpendStatus } from "../guardrails/spend-guard.js";
import { attestPayment } from "../guardrails/attestation.js";
import { scheduleAgentPayment } from "../guardrails/scheduler.js";
import { trackSchedule, startScheduleTracker } from "../guardrails/schedule-tracker.js";
import { setAgentPolicy, listAgentPolicies, deleteAgentPolicy } from "../guardrails/policies.js";
import { toDecimalAmount, getAssetInfo, getHbarUsdPrice } from "../guardrails/assets.js";

const app = express();
app.use(express.json());

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../../public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", account: config.hederaAccountId, network: config.hederaNetwork });
});

// Now protected: unpaid responds 402, paid responds 200
app.use(
  paymentMiddleware(
    {
      "GET /data/example": dataRouteConfig,
      "GET /data/premium": premiumRouteConfig,
      "GET /data/example-usdc": usdcRouteConfig,
    },
    resourceServer,
  ),
);

app.get("/data/example", (req, res) => {
  const responseBody = {
    message: "You paid for this via x402 on Hedera testnet 🎉",
    timestamp: new Date().toISOString(),
  };

  res.json(responseBody);

  // The payment-response header is added by the middleware AFTER the
  // handler returns (post-response settlement), so we wait for the
  // "finish" event to read it with certainty that it's already present.
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
    message: "Premium access unlocked via x402 — extended dataset 🎉",
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

app.get("/data/example-usdc", (req, res) => {
  const responseBody = {
    message: "You paid in USDC via x402 on Hedera testnet 💵",
    timestamp: new Date().toISOString(),
  };

  res.json(responseBody);

  res.on("finish", () => {
    const paymentResponseHeader = res.getHeader("payment-response");
    if (!paymentResponseHeader) return;

    const decoded = JSON.parse(
      Buffer.from(paymentResponseHeader.toString(), "base64").toString("utf-8"),
    );

    attestPayment({
      route: "/data/example-usdc",
      payer: decoded.payer,
      amount: usdcRouteConfig.accepts[0].price.amount,
      asset: usdcRouteConfig.accepts[0].price.asset,
      transactionId: decoded.transaction,
    });
  });
});

// Check the spend status of a specific buyer account
app.get("/admin/spend/:accountId", (req, res) => {
  const assetId = req.query.asset || "0.0.0";
  const status = getSpendStatus(req.params.accountId, assetId);
  res.json(status);
});

// Check the configured global limits
app.get("/admin/limits", (req, res) => {
  const assetId = req.query.asset || "0.0.0";
  const defaults = config.assetDefaults[assetId] || config.assetDefaults["0.0.0"];
  res.json({
    assetId,
    maxTxTinybars: defaults.maxTx.toString(),
    maxDailyTinybars: defaults.maxDaily.toString(),
  });
});

app.get("/admin/dashboard-data", async (req, res) => {
  const buyerAccountId = req.query.account || process.env.BUYER_ACCOUNT_ID;
  const assetId = req.query.asset || "0.0.0";
  const spend = getSpendStatus(buyerAccountId, assetId);
  const defaults = config.assetDefaults[assetId] || config.assetDefaults["0.0.0"];

  const assetInfo = getAssetInfo(assetId);
  const hbarUsdPrice = assetId === "0.0.0" ? await getHbarUsdPrice() : null;

  const spendDecimal = {
    spentToday: toDecimalAmount(assetId, spend.spentToday),
    maxDaily: toDecimalAmount(assetId, spend.maxDaily),
    maxPerTx: toDecimalAmount(assetId, spend.maxPerTx),
    remainingToday: toDecimalAmount(assetId, spend.remainingToday),
    symbol: assetInfo.symbol,
    usdApproxSpentToday:
      hbarUsdPrice !== null
        ? (Number(toDecimalAmount(assetId, spend.spentToday)) * hbarUsdPrice).toFixed(2)
        : null,
  };

  const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=${config.hederaAccountId}&transactiontype=CRYPTOTRANSFER&limit=5&order=desc`;
  const mirrorRes = await fetch(mirrorUrl);
  const mirrorData = await mirrorRes.json();

  const recentPayments = mirrorData.transactions.map((tx) => ({
    transactionId: tx.transaction_id,
    result: tx.result,
    timestamp: tx.consensus_timestamp,
    hashscanUrl: `https://hashscan.io/testnet/transaction/${tx.transaction_id}`,
  }));

  let attestations = [];

  if (config.hcsTopicId) {
    const hcsUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${config.hcsTopicId}/messages?limit=5&order=desc`;
    const hcsRes = await fetch(hcsUrl);
    const hcsData = await hcsRes.json();

    if (Array.isArray(hcsData.messages)) {
      attestations = hcsData.messages.map((m) => {
        const decoded = JSON.parse(Buffer.from(m.message, "base64").toString("utf-8"));
        return {
          sequenceNumber: m.sequence_number,
          timestamp: m.consensus_timestamp,
          decoded,
          decodedAmount: toDecimalAmount(decoded.asset, decoded.amount),
          decodedSymbol: getAssetInfo(decoded.asset).symbol,
          hashscanUrl: `https://hashscan.io/testnet/topic/${config.hcsTopicId}`,
        };
      });
    }
  }

  res.json({
    limits: {
      assetId,
      maxTxTinybars: defaults.maxTx.toString(),
      maxDailyTinybars: defaults.maxDaily.toString(),
    },
    spend,
    spendDecimal,
    recentPayments,
    attestations,
    hcsTopicId: config.hcsTopicId,
  });
});

// Create or update the policy for a specific agent
app.post("/admin/policies/:accountId", express.json(), (req, res) => {
  const { assetId, label, maxTxTinybars, maxDailyTinybars } = req.body;

  if (!assetId || !maxTxTinybars || !maxDailyTinybars) {
    return res.status(400).json({ error: "Missing fields: assetId, maxTxTinybars, maxDailyTinybars" });
  }

  const policy = setAgentPolicy(req.params.accountId, assetId, { label, maxTxTinybars, maxDailyTinybars });
  res.json({
    ...policy,
    maxTxTinybars: policy.maxTxTinybars.toString(),
    maxDailyTinybars: policy.maxDailyTinybars.toString(),
  });
});

app.get("/admin/policies", (req, res) => {
  res.json(listAgentPolicies());
});

app.delete("/admin/policies/:accountId", (req, res) => {
  const assetId = req.query.asset || "0.0.0";
  const deleted = deleteAgentPolicy(req.params.accountId, assetId);
  res.json({ deleted });
});

// The buyer pre-authorizes a future payment — the guardrail is evaluated
// here, not at execution time (which happens with no human intervention).
app.post("/schedule-payment", express.json(), async (req, res) => {
  const { buyerAccountId, buyerPrivateKey, amountTinybars, delayMinutes, memo } = req.body;

  if (!buyerAccountId || !buyerPrivateKey || !amountTinybars || !delayMinutes) {
    return res.status(400).json({
      error: "Missing fields: buyerAccountId, buyerPrivateKey, amountTinybars, delayMinutes",
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
  console.log(`Server listening at http://localhost:${config.port}`);
});