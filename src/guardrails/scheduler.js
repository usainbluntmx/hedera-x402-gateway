import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  TransferTransaction,
  ScheduleCreateTransaction,
  Timestamp,
} from "@hiero-ledger/sdk";
import { config } from "../config/env.js";
import { checkSpendLimit } from "./spend-guard.js";

const HBAR_ASSET_ID = "0.0.0"; // este scheduler solo maneja HBAR nativo por ahora

/**
 * Crea un pago programado en Hedera: el comprador pre-autoriza el gasto
 * una sola vez, y la red lo ejecuta sola cuando llega la hora — sin que
 * el comprador tenga que estar en línea ni volver a firmar.
 *
 * El guardrail de gasto se evalúa AL MOMENTO DE PROGRAMAR, no al ejecutarse,
 * ya que es cuando tenemos control real sobre la decisión.
 */
export async function scheduleAgentPayment({
  buyerAccountId,
  buyerPrivateKey,
  amountTinybars,
  delayMinutes,
  memo,
}) {
  const check = checkSpendLimit(buyerAccountId, HBAR_ASSET_ID, amountTinybars);
  if (!check.allowed) {
    throw new Error(`🛑 Guardrail bloqueó la programación: ${check.reason}`);
  }

  const buyerId = AccountId.fromString(buyerAccountId);
  const buyerKey = PrivateKey.fromStringECDSA(buyerPrivateKey);
  const sellerId = AccountId.fromString(config.hederaAccountId);

  const client = Client.forTestnet();
  client.setOperator(buyerId, buyerKey);

  try {
    const transferTx = new TransferTransaction()
      .addHbarTransfer(buyerId, Hbar.fromTinybars(-amountTinybars))
      .addHbarTransfer(sellerId, Hbar.fromTinybars(amountTinybars));

    const expiration = Timestamp.fromDate(new Date(Date.now() + delayMinutes * 60 * 1000));

    const scheduleTx = await new ScheduleCreateTransaction()
      .setScheduledTransaction(transferTx)
      .setScheduleMemo(memo || "x402 pre-authorized payment")
      .setExpirationTime(expiration)
      .setWaitForExpiry(true)
      .execute(client);

    const receipt = await scheduleTx.getReceipt(client);

    return {
      scheduleId: receipt.scheduleId.toString(),
      scheduledTransactionId: receipt.scheduledTransactionId.toString(),
      executesAt: expiration.toDate().toISOString(),
      hashscanUrl: `https://hashscan.io/testnet/schedule/${receipt.scheduleId.toString()}`,
    };
  } finally {
    client.close();
  }
}