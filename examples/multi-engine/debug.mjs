import { config } from "dotenv";
config();

const BASE = process.env.TRASHDB_BASE_URL || "https://api.trashdb.dev/api/v1";
const KEY = process.env.TRASHDB_API_KEY || "";

async function main() {
  console.log(`POST ${BASE}/containers (chromadb, ttl=5)`);

  const res = await fetch(`${BASE}/containers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": KEY },
    body: JSON.stringify({ engine: "chromadb", ttlMinutes: 5 }),
  });

  console.log("Status:", res.status);
  const text = await res.text();
  try {
    console.log("Body:", JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log("Raw body:", text);
  }
}

main().catch(console.error);
