import "dotenv/config";
import { createClientHederaSigner } from "@x402/hedera";
import { PrivateKey, Transaction } from "@hiero-ledger/sdk";

const hederaSigner = createClientHederaSigner(
  process.env.HEDERA_ACCOUNT_ID,
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY),
  { network: "hedera:testnet" },
);

// Simulamos los mismos paymentRequirements que vimos en el header 402 decodificado
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
console.log("Transacción firmada (base64), longitud:", base64Tx.length);

const decoded = Transaction.fromBytes(Buffer.from(base64Tx, "base64"));
console.log("Transaction ID:", decoded.transactionId?.toString());
console.log("Token transfers (interno, fuente real):");
for (const t of decoded._tokenTransfers) {
  console.log({
    tokenId: t.tokenId.toString(),
    accountId: t.accountId.toString(),
    amount: t.amount.toString(),
  });
}