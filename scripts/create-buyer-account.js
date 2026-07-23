import "dotenv/config";
import {
  Client,
  AccountId,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
} from "@hiero-ledger/sdk";

const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

const newKey = PrivateKey.generateECDSA();

const tx = await new AccountCreateTransaction()
  .setKeyWithoutAlias(newKey.publicKey)
  .setInitialBalance(new Hbar(20))
  .execute(client);

const receipt = await tx.getReceipt(client);
const newAccountId = receipt.accountId;

console.log("Nueva cuenta (comprador) creada:");
console.log("Account ID:", newAccountId.toString());
console.log("Private Key (ECDSA):", newKey.toStringRaw());

client.close();