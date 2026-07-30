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

const HBAR_ASSET_ID = "0.0.0"; // this scheduler only handles native HBAR for now

/**
 * Creates a scheduled payment on Hedera: the buyer pre-authorizes the
 * spend once, and the network executes it on its own when it comes due —
 * with no need for the buyer to be online or sign again.
 *
 * The spend guardrail is evaluated AT SCHEDULING TIME, not at execution,
 * since that's when we actually have control over the decision.
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
    throw new Error(`🛑 Guardrail blocked the scheduling: ${check.reason}`);
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