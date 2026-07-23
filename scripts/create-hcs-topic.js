import "dotenv/config";
import {
  Client,
  AccountId,
  PrivateKey,
  TopicCreateTransaction,
} from "@hiero-ledger/sdk";

const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

const tx = await new TopicCreateTransaction()
  .setTopicMemo("Hedera x402 Gateway - Payment Attestation Log")
  .execute(client);

const receipt = await tx.getReceipt(client);
console.log("Topic ID:", receipt.topicId.toString());
console.log("Transaction ID:", tx.transactionId.toString());

client.close();