import {describe, it, expect, beforeAll, afterAll} from "vitest";
import Redis from "ioredis";
import { db, when } from "./setup.js";
import {ContainerResponse} from "../../../src";

let connectionString: string;
let container: ContainerResponse;

beforeAll(async () => {
  container = await db.createContainer({
    engine: "redis",
    ...when(15),
  });
  connectionString = container.connectionString;
});

afterAll(async () => {
  if (container) await db.destroyContainer(container.id);
});

describe("Redis", () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(connectionString);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("should set and get string values", async () => {
    await redis.set("greeting", "hello from trashdb");
    const value = await redis.get("greeting");
    expect(value).toBe("hello from trashdb");
  });

  it("should handle TTL", async () => {
    await redis.setex("temp_key", 10, "will expire");
    const ttl = await redis.ttl("temp_key");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it("should support lists", async () => {
    await redis.rpush("queue", "job1", "job2", "job3");
    const length = await redis.llen("queue");
    expect(length).toBe(3);

    const item = await redis.lpop("queue");
    expect(item).toBe("job1");
  });

  it("should support hashes", async () => {
    await redis.hset("user:1", { name: "Alice", email: "alice@test.com" });
    const name = await redis.hget("user:1", "name");
    expect(name).toBe("Alice");

    const all = await redis.hgetall("user:1");
    expect(all.email).toBe("alice@test.com");
  });
});
