import "dotenv/config";
import { createClientHederaSigner } from "@x402/hedera";
import { PrivateKey, Transaction } from "@hiero-ledger/sdk";

const hederaSigner = createClientHederaSigner(
  process.env.HEDERA_ACCOUNT_ID,
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY),
  { network: "hedera:testnet" },
);

// Simulating the same paymentRequirements we saw in the decoded 402 header
const requirements = {
  scheme: "exact",
  network: "hedera:testnet",
  amount: "1000",
  asset: "0.0.429274",
  payTo: "0.0.9692115",
  maxTimeoutSeconds: 300,
  extra: { feePayer: "0.0.9185802" },
};

const base64Tx = await hederaSigner.createPartiallySignedTransferTransaction(requirements);
console.log("Signed transaction (base64), length:", base64Tx.length);

const decoded = Transaction.fromBytes(Buffer.from(base64Tx, "base64"));
console.log("Transaction ID:", decoded.transactionId?.toString());
console.log("Token transfers (internal, real source):");
for (const t of decoded._tokenTransfers) {
  console.log({
    tokenId: t.tokenId.toString(),
    accountId: t.accountId.toString(),
    amount: t.amount.toString(),
  });
}