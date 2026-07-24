import "dotenv/config";

const res = await fetch("http://localhost:4021/schedule-payment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    buyerAccountId: process.env.BUYER_ACCOUNT_ID,
    buyerPrivateKey: process.env.BUYER_PRIVATE_KEY,
    amountTinybars: 1000000,
    delayMinutes: 2,
    memo: "Pre-autorizado vía API del gateway",
  }),
});

const data = await res.json();
console.log(data);