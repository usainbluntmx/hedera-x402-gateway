import "dotenv/config";

export const config = {
  hederaAccountId: process.env.HEDERA_ACCOUNT_ID,
  hederaPrivateKey: process.env.HEDERA_PRIVATE_KEY,
  hederaNetwork: process.env.HEDERA_NETWORK || "testnet",
  facilitatorUrl: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
  port: Number(process.env.PORT) || 4021,
  assetDefaults: {
    "0.0.0": {
      // HBAR nativo — tinybars, 8 decimales
      maxTx: BigInt(process.env.MAX_TX_TINYBARS || "5000000"),
      maxDaily: BigInt(process.env.MAX_DAILY_TINYBARS || "20000000"),
    },
    "0.0.429274": {
      // USDC testnet — 6 decimales
      maxTx: BigInt(process.env.MAX_TX_USDC_UNITS || "500000"), // 0.50 USDC
      maxDaily: BigInt(process.env.MAX_DAILY_USDC_UNITS || "5000000"), // 5.00 USDC
    },
  },
  hcsTopicId: process.env.HCS_TOPIC_ID,
};

const required = ["hederaAccountId", "hederaPrivateKey"];
for (const key of required) {
  if (!config[key]) {
    throw new Error(`Falta la variable de entorno para: ${key}`);
  }
}