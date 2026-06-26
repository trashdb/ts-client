import { TrashDB, TrashDBAPIError } from "@trashdb/ts";
import pg from "pg";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {ContainerResponse} from "../../../src";

const db = new TrashDB({
  apiKey: process.env.TRASHDB_API_KEY!,
  ...(process.env.TRASHDB_BASE_URL ? { baseUrl: process.env.TRASHDB_BASE_URL } : {}),
});

let connectionString: string;
let container: ContainerResponse;

beforeAll(async () => {
  container = await db.createContainer({
    engine: "postgres",
    ttlMinutes: 15,
    name: "vitest-integration-test",
  });
  connectionString = container.connectionString;
}, 30_000);

afterAll(async () => {
  await db.destroyContainer(container.id);
});

describe("User repository with disposable Postgres", () => {
  async function runQuery(query: string, params?: unknown[]) {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      return await client.query(query, params);
    } finally {
      await client.end();
    }
  }

  it("should create the users table", async () => {
    await runQuery(
      "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())",
    );
    const result = await runQuery(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'",
    );
    expect(result.rows.length).toBe(1);
  });

  it("should insert and retrieve a user", async () => {
    await runQuery(
      "INSERT INTO users (email, name) VALUES ($1, $2)",
      ["alice@test.com", "Alice"],
    );

    const result = await runQuery(
      "SELECT * FROM users WHERE email = $1",
      ["alice@test.com"],
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].name).toBe("Alice");
    expect(result.rows[0].email).toBe("alice@test.com");
  });

  it("should enforce unique email constraint", async () => {
    await runQuery(
      "INSERT INTO users (email, name) VALUES ($1, $2)",
      ["bob@test.com", "Bob"],
    );

    await expect(
      runQuery("INSERT INTO users (email, name) VALUES ($1, $2)", ["bob@test.com", "Bob2"]),
    ).rejects.toThrow();
  });

  it("should find user by id", async () => {
    const insertResult = await runQuery(
      "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id",
      ["carol@test.com", "Carol"],
    );
    const userId = insertResult.rows[0].id;

    const result = await runQuery("SELECT * FROM users WHERE id = $1", [userId]);
    expect(result.rows[0].name).toBe("Carol");
  });

  it("should list all users ordered by creation date", async () => {
    const result = await runQuery(
      "SELECT email, name FROM users ORDER BY id ASC",
    );
    expect(result.rows.map((r: { email: string }) => r.email)).toEqual([
      "alice@test.com",
      "bob@test.com",
      "carol@test.com",
    ]);
  });

  it("should delete a user", async () => {
    await runQuery("DELETE FROM users WHERE email = $1", ["alice@test.com"]);
    const result = await runQuery("SELECT * FROM users WHERE email = $1", ["alice@test.com"]);
    expect(result.rows.length).toBe(0);
  });
});

describe("TrashDB API integration", () => {
  it("should list available engines", async () => {
    const engines = await db.getEngines();
    expect(engines.length).toBeGreaterThan(0);
    expect(engines[0]).toHaveProperty("id");
    expect(engines[0]).toHaveProperty("name");
    expect(engines[0]).toHaveProperty("maxTtlMinutes");
  });

  it("should list running containers", async () => {
    const containers = await db.getRunningContainers();
    expect(Array.isArray(containers)).toBe(true);
  });

  it("should throw TrashDBAPIError for unknown engine", async () => {
    await expect(
      db.createContainer({ engine: "nonexistent-engine" }),
    ).rejects.toThrow(TrashDBAPIError);
  });

  it("should throw TrashDBAPIError when destroying nonexistent container", async () => {
    await expect(
      db.destroyContainer("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(TrashDBAPIError);
  });
});
