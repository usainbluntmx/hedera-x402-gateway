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
 * Escribe un mensaje de atestación a HCS por cada pago liquidado.
 * No bloquea la respuesta al cliente — corre en segundo plano ("fire and forget"),
 * con manejo de error propio para no tumbar el request si HCS falla.
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
    console.log(`📝 Atestación en HCS registrada — seq #${receipt.topicSequenceNumber}`);
    return { success: true, sequenceNumber: receipt.topicSequenceNumber.toString() };
  } catch (error) {
    console.error("⚠️ Falló la atestación en HCS (no afecta el pago ya liquidado):", error.message);
    return { success: false, error: error.message };
  }
}