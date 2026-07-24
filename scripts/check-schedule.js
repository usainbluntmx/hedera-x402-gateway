import "dotenv/config";

const SCHEDULE_ID = process.argv[2];
if (!SCHEDULE_ID) {
  console.error("Uso: node scripts/check-schedule.js <SCHEDULE_ID>");
  process.exit(1);
}

const url = `https://testnet.mirrornode.hedera.com/api/v1/schedules/${SCHEDULE_ID}`;
const res = await fetch(url);
const data = await res.json();

console.log("Schedule ID:", data.schedule_id);
console.log("Memo:", data.memo);
console.log("Fecha de creación:", data.consensus_timestamp);
console.log("Fecha de ejecución:", data.executed_timestamp || "(todavía no se ha ejecutado)");
console.log("Deleted:", data.deleted);

if (data.executed_timestamp) {
  console.log("\n✅ Se ejecutó sola, sin intervención del comprador.");
  console.log(`HashScan: https://hashscan.io/testnet/schedule/${SCHEDULE_ID}`);
}