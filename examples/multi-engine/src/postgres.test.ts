import {describe, it, expect, beforeAll, afterAll} from "vitest";
import pg from "pg";
import { db, when } from "./setup.js";
import {ContainerResponse} from "../../../src";

let connectionString: string;
let container: ContainerResponse;

beforeAll(async () => {
  container = await db.createContainer({
    engine: "postgres",
    ...when(15),
  });
  connectionString = container.connectionString;
});

afterAll(async () => {
  if (container) await db.destroyContainer(container.id);
});

describe("PostgreSQL", () => {
  async function query(sql: string, params?: unknown[]) {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      return await client.query(sql, params);
    } finally {
      await client.end();
    }
  }

  it("should create table and insert data", async () => {
    await query("CREATE TABLE IF NOT EXISTS books (id SERIAL PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL)");
    await query("INSERT INTO books (title, author) VALUES ($1, $2)", ["Clean Code", "Robert C. Martin"]);
    const result = await query("SELECT * FROM books WHERE author = $1", ["Robert C. Martin"]);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].title).toBe("Clean Code");
  });

  it("should enforce unique constraints", async () => {
    await query("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, sku TEXT UNIQUE NOT NULL)");
    await query("INSERT INTO products (sku) VALUES ($1)", ["ABC-123"]);
    await expect(query("INSERT INTO products (sku) VALUES ($1)", ["ABC-123"])).rejects.toThrow();
  });

  it("should support transactions", async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, total NUMERIC NOT NULL)");
      await client.query("INSERT INTO orders (total) VALUES ($1)", [99.99]);
      await client.query("COMMIT");
      const result = await client.query("SELECT COUNT(*) FROM orders");
      expect(Number(result.rows[0].count)).toBe(1);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      await client.end();
    }
  });
});
