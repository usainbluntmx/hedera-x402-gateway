import "dotenv/config";

const accounts = {
  vendedor: process.env.HEDERA_ACCOUNT_ID,
  comprador: process.env.BUYER_ACCOUNT_ID,
};

async function fetchTransactions(accountId, label) {
  const url = `https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=${accountId}&limit=10&order=desc`;
  const res = await fetch(url);
  const data = await res.json();

  console.log(`\n=== Transacciones de ${label} (${accountId}) ===`);
  for (const tx of data.transactions) {
    const hashscanId = tx.transaction_id.replace("@", "-").replace(/\./g, "-").replace(/-(\d{9})$/, "-$1");
    console.log(`- ${tx.name} | ${tx.result} | ${tx.consensus_timestamp}`);
    console.log(`  https://hashscan.io/testnet/transaction/${tx.transaction_id}`);
  }
}

await fetchTransactions(accounts.vendedor, "vendedor");
await fetchTransactions(accounts.comprador, "comprador");