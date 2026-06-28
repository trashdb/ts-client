import {describe, it, expect, beforeAll, afterAll} from "vitest";
import { MongoClient } from "mongodb";
import { db, when } from "./setup.js";
import {ContainerResponse} from "../../../src";

let connectionString: string;
let container: ContainerResponse;

beforeAll(async () => {
  container = await db.createContainer({
    engine: "mongodb",
    ...when(15),
  });
  connectionString = container.connectionString;
});

afterAll(async () => {
  if (container) await db.destroyContainer(container.id);
});

describe("MongoDB", () => {
  let client: MongoClient;

  beforeAll(async () => {
    client = new MongoClient(connectionString);
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it("should insert and find documents", async () => {
    const collection = client.db("test").collection("users");
    await collection.insertOne({ name: "Alice", email: "alice@test.com", age: 30 });

    const doc = await collection.findOne({ email: "alice@test.com" });
    expect(doc).toBeTruthy();
    expect(doc!.name).toBe("Alice");
  });

  it("should support indexes", async () => {
    const collection = client.db("test").collection("orders");
    await collection.createIndex({ orderId: 1 }, { unique: true });

    await collection.insertOne({ orderId: "ORD-001", total: 49.99 });
    await expect(
      collection.insertOne({ orderId: "ORD-001", total: 99.99 })
    ).rejects.toThrow();
  });

  it("should run aggregations", async () => {
    const collection = client.db("test").collection("sales");
    await collection.insertMany([
      { product: "laptop", amount: 1200 },
      { product: "mouse", amount: 25 },
      { product: "monitor", amount: 300 },
      { product: "laptop", amount: 1400 },
    ]);

    const pipeline = [
      { $group: { _id: "$product", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    expect(results.length).toBe(3);
    expect(results[0]._id).toBe("laptop");
    expect(results[0].total).toBe(2600);
  });
});
