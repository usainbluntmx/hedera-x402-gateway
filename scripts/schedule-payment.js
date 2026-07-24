import "dotenv/config";
import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  TransferTransaction,
  ScheduleCreateTransaction,
  Timestamp,
} from "@hiero-ledger/sdk";

const buyerId = AccountId.fromString(process.env.BUYER_ACCOUNT_ID);
const buyerKey = PrivateKey.fromStringECDSA(process.env.BUYER_PRIVATE_KEY);
const sellerId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);

const client = Client.forTestnet();
client.setOperator(buyerId, buyerKey);

const AMOUNT_TINYBARS = 1_000_000; // mismo precio que /data/example
const MINUTES_FROM_NOW = 3; // se ejecuta sola en 3 minutos, sin intervención

const transferTx = new TransferTransaction()
  .addHbarTransfer(buyerId, Hbar.fromTinybars(-AMOUNT_TINYBARS))
  .addHbarTransfer(sellerId, Hbar.fromTinybars(AMOUNT_TINYBARS));

const expiration = Timestamp.fromDate(new Date(Date.now() + MINUTES_FROM_NOW * 60 * 1000));

const scheduleTx = await new ScheduleCreateTransaction()
  .setScheduledTransaction(transferTx)
  .setScheduleMemo("x402 pre-authorized payment - Hedera Gateway")
  .setExpirationTime(expiration)
  .setWaitForExpiry(true) // espera hasta la expiración, no ejecuta antes
  .execute(client);

const receipt = await scheduleTx.getReceipt(client);

console.log("Schedule ID:", receipt.scheduleId.toString());
console.log("Scheduled Transaction ID:", receipt.scheduledTransactionId.toString());
console.log(`Se ejecutará sola en ~${MINUTES_FROM_NOW} minutos, sin que el comprador esté presente.`);
console.log(`Ver en HashScan: https://hashscan.io/testnet/schedule/${receipt.scheduleId.toString()}`);

client.close();