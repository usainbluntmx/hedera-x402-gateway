import "dotenv/config";
import {
  Client,
  AccountId,
  PrivateKey,
  TokenAssociateTransaction,
} from "@hiero-ledger/sdk";

const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
const privateKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);
const TOKEN_ID = "0.0.429274";

const client = Client.forTestnet();
client.setOperator(accountId, privateKey);

const tx = await new TokenAssociateTransaction()
  .setAccountId(accountId)
  .setTokenIds([TOKEN_ID])
  .freezeWith(client)
  .sign(privateKey);

const submit = await tx.execute(client);
const receipt = await submit.getReceipt(client);

console.log("Association status:", receipt.status.toString());
console.log("Transaction ID:", submit.transactionId.toString());

client.close();