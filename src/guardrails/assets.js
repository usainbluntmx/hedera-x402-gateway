const ASSET_INFO = {
  "0.0.0": { symbol: "HBAR", decimals: 8 },
  "0.0.429274": { symbol: "USDC", decimals: 6 },
};

export function getAssetInfo(assetId) {
  return ASSET_INFO[assetId] || { symbol: assetId, decimals: 0 };
}

/**
 * Convierte una cantidad en unidades atómicas (string o BigInt) a su
 * representación decimal legible, según los decimales del asset.
 */
export function toDecimalAmount(assetId, atomicAmount) {
  const { decimals } = getAssetInfo(assetId);
  const amount = BigInt(atomicAmount);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "") || "0";
  return `${whole}.${fractionStr}`.replace(/\.0$/, ".0");
}

// ---------- Precio de HBAR en USD, cacheado (CoinGecko rate-limita el endpoint público) ----------
let cachedHbarPrice = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export async function getHbarUsdPrice() {
  const now = Date.now();
  if (cachedHbarPrice !== null && now - cachedAt < CACHE_MS) {
    return cachedHbarPrice;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd",
    );
    const data = await res.json();
    const price = data?.["hedera-hashgraph"]?.usd;
    if (typeof price === "number") {
      cachedHbarPrice = price;
      cachedAt = now;
    }
  } catch {
    // Si falla, seguimos usando el último precio cacheado (o null si nunca se obtuvo)
  }
  return cachedHbarPrice;
}