import {describe, it, expect, beforeAll, afterAll} from "vitest";
import pg from "pg";
import { db, when } from "./setup.js";
import {ContainerResponse} from "../../../src";

let connectionString: string;
let container: ContainerResponse;

async function waitForConnection(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = new pg.Client({ connectionString });
      await client.connect();
      await client.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Supabase container not reachable after retries");
}

beforeAll(async () => {
  container = await db.createContainer({
    engine: "supabase",
    ...when(15),
  });
  connectionString = container.connectionString;
  await waitForConnection();
});

afterAll(async () => {
  if (container) await db.destroyContainer(container.id);
});

describe("Supabase (PostgreSQL)", () => {
  async function query(sql: string, params?: unknown[]) {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      return await client.query(sql, params);
    } finally {
      await client.end();
    }
  }

  it("should create table with timestamps", async () => {
    await query(
      "CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, name TEXT NOT NULL, occurred_at TIMESTAMPTZ DEFAULT NOW())"
    );
    await query("INSERT INTO events (name) VALUES ($1)", ["user_signup"]);
    const result = await query("SELECT * FROM events WHERE name = $1", ["user_signup"]);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].occurred_at).toBeTruthy();
  });

  it("should support JSONB columns", async () => {
    await query(
      "CREATE TABLE IF NOT EXISTS profiles (id SERIAL PRIMARY KEY, metadata JSONB DEFAULT '{}')"
    );
    await query("INSERT INTO profiles (metadata) VALUES ($1)", [JSON.stringify({ theme: "dark", role: "admin" })]);
    const result = await query("SELECT metadata->>'theme' as theme FROM profiles");
    expect(result.rows[0].theme).toBe("dark");
  });
});
