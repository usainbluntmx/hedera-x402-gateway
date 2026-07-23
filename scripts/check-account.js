import "dotenv/config";
import { Client, AccountId, PrivateKey, AccountBalanceQuery } from "@hiero-ledger/sdk";

const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
const privateKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);

const client = Client.forTestnet();
client.setOperator(accountId, privateKey);

const balance = await new AccountBalanceQuery()
  .setAccountId(accountId)
  .execute(client);

console.log(`Cuenta: ${accountId.toString()}`);
console.log(`Balance: ${balance.hbars.toString()}`);

client.close();