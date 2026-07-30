import {
  Client,
  AccountId,
  PrivateKey,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { config } from "../config/env.js";

let client;
function getClient() {
  if (!client) {
    client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(config.hederaAccountId),
      PrivateKey.fromStringECDSA(config.hederaPrivateKey),
    );
  }
  return client;
}

/**
 * Writes an HCS attestation message for every settled payment.
 * Doesn't block the response to the client — runs in the background
 * ("fire and forget"), with its own error handling so a failed HCS
 * write never takes down the request.
 */
export async function attestPayment({ route, payer, amount, asset, transactionId }) {
  try {
    const message = JSON.stringify({
      route,
      payer,
      amount,
      asset,
      settlementTx: transactionId,
      attestedAt: new Date().toISOString(),
    });

    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(config.hcsTopicId)
      .setMessage(message)
      .execute(getClient());

    const receipt = await tx.getReceipt(getClient());
    console.log(`📝 HCS attestation recorded — seq #${receipt.topicSequenceNumber}`);
    return { success: true, sequenceNumber: receipt.topicSequenceNumber.toString() };
  } catch (error) {
    console.error("⚠️ HCS attestation failed (doesn't affect the already-settled payment):", error.message);
    return { success: false, error: error.message };
  }
}