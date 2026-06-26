import pg from "pg";
import IORedis from "ioredis";
import { MongoClient } from "mongodb";

export type SupportedEngine = "postgres" | "redis" | "mongodb" | "chromadb" | "qdrant" | "supabase";

export async function probeConnection(engine: string, connectionString: string): Promise<string> {
  switch (engine) {
    case "postgres":
    case "supabase":
      return probePostgres(connectionString);
    case "redis":
      return probeRedis(connectionString);
    case "mongodb":
      return probeMongo(connectionString);
    case "chromadb":
    case "qdrant":
      return `${engine} via HTTP at ${connectionString}`;
    default:
      return `Connection: ${connectionString}`;
  }
}

async function probePostgres(connectionString: string): Promise<string> {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach the database from here. The container is running inside TrashDB's infrastructure and is only reachable from environments connected to it (CI, Docker network, etc.).\n` +
      `Connection string: ${connectionString}\n` +
      `Underlying error: ${err instanceof Error ? err.message : err}`,
    );
  }
  try {
    await client.query("CREATE TABLE IF NOT EXISTS demo_visits (id SERIAL PRIMARY KEY, visited_at TIMESTAMPTZ DEFAULT NOW(), note TEXT)");
    await client.query("INSERT INTO demo_visits (note) VALUES ($1)", ["visited from trashdb-cli"]);
    const { rows } = await client.query("SELECT * FROM demo_visits ORDER BY id DESC LIMIT 5");
    return `Postgres OK — ${rows.length} row(s) in demo_visits:\n${rows.map((r: Record<string, unknown>) => `  [${r.id}] ${r.visited_at} — ${r.note}`).join("\n")}`;
  } finally {
    await client.end();
  }
}

async function probeRedis(connectionString: string): Promise<string> {
  const redis = new IORedis(connectionString);
  try {
    await redis.set("trashdb:demo", "hello from trashdb-cli");
    const val = await redis.get("trashdb:demo");
    const ttl = await redis.ttl("trashdb:demo");
    return `Redis OK — key trashdb:demo = "${val}" (TTL: ${ttl}s)`;
  } catch (err) {
    throw new Error(
      `Cannot reach Redis from here. The container is running inside TrashDB's infrastructure.\n` +
      `Connection string: ${connectionString}\n` +
      `Underlying error: ${err instanceof Error ? err.message : err}`,
    );
  } finally {
    redis.disconnect();
  }
}

async function probeMongo(connectionString: string): Promise<string> {
  const mongo = new MongoClient(connectionString);
  try {
    await mongo.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach MongoDB from here. The container is running inside TrashDB's infrastructure.\n` +
      `Connection string: ${connectionString}\n` +
      `Underlying error: ${err instanceof Error ? err.message : err}`,
    );
  }
  try {
    const db = mongo.db();
    const col = db.collection("demo");
    await col.insertOne({ message: "hello from trashdb-cli", ts: new Date() });
    const docs = await col.find().sort({ _id: -1 }).limit(3).toArray();
    return `MongoDB OK — ${docs.length} doc(s) in demo collection:\n${docs.map((d) => `  ${JSON.stringify(d)}`).join("\n")}`;
  } finally {
    await mongo.close();
  }
}
