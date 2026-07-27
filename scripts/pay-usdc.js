import "dotenv/config";
import { wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner } from "@x402/hedera";
import { PrivateKey } from "@hiero-ledger/sdk";
import { guardedFetch } from "../src/guardrails/guarded-fetch.js";

const HEDERA_NETWORK = "hedera:testnet";
const TARGET_URL = "http://localhost:4021/data/example-usdc";

const hederaSigner = createClientHederaSigner(
  process.env.BUYER_ACCOUNT_ID,
  PrivateKey.fromStringECDSA(process.env.BUYER_PRIVATE_KEY),
  { network: HEDERA_NETWORK },
);

const client = new x402Client();
client.register(HEDERA_NETWORK, new ExactHederaScheme(hederaSigner));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

console.log("Solicitando recurso pagado en USDC (con guardrail activo)...");

try {
  const response = await guardedFetch(
    fetchWithPayment,
    process.env.BUYER_ACCOUNT_ID,
    TARGET_URL,
    { method: "GET" },
  );

  console.log("Status HTTP final:", response.status);

  const result = await httpClient.processResponse(response);
  console.log("Respuesta del servidor:", result.body);
  console.log("Estado del pago:", result.paymentStatus);
} catch (error) {
  console.error("❌", error.message);
}