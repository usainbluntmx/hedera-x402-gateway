import { x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { config } from "../config/env.js";

export const HEDERA_NETWORK = "hedera:testnet";
export const HBAR_ASSET_ID = "0.0.0"; // confirmado en @x402/hedera y en la doc oficial de x402

// Facilitador oficial de x402 — soporta hedera:testnet sin configuración extra
export const facilitatorClient = new HTTPFacilitatorClient({
  url: config.facilitatorUrl,
});

// Servidor de recursos x402, con el esquema "exact" registrado para Hedera
export const resourceServer = new x402ResourceServer(facilitatorClient).register(
  HEDERA_NETWORK,
  new ExactHederaScheme(),
);

// Precio: 0.01 HBAR = 1,000,000 tinybars (1 HBAR = 10^8 tinybars)
export const dataRouteConfig = {
  accepts: [
    {
      scheme: "exact",
      network: HEDERA_NETWORK,
      payTo: config.hederaAccountId,
      price: {
        asset: HBAR_ASSET_ID,
        amount: "1000000",
      },
    },
  ],
  description: "Acceso a datos de ejemplo vía x402 en Hedera testnet (pago en HBAR)",
  mimeType: "application/json",
};

// Segunda ruta con precio distinto — demuestra que el gateway es middleware
// reusable, no una app con un único endpoint pago hardcodeado.
export const premiumRouteConfig = {
  accepts: [
    {
      scheme: "exact",
      network: HEDERA_NETWORK,
      payTo: config.hederaAccountId,
      price: {
        asset: HBAR_ASSET_ID,
        amount: "5000000", // 0.05 HBAR — 5x el precio del endpoint básico
      },
    },
  ],
  description: "Acceso a datos premium vía x402 en Hedera testnet (pago en HBAR)",
  mimeType: "application/json",
};