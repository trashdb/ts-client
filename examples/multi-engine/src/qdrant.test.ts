import {describe, it, expect, beforeAll, afterAll} from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";
import { db, when } from "./setup.js";
import {ContainerResponse} from "../../../src";

let connectionString: string;
let container: ContainerResponse;

beforeAll(async () => {
  container = await db.createContainer({
    engine: "qdrant",
    ...when(15),
  });
  connectionString = container.connectionString;
});

afterAll(async () => {
  if (container) await db.destroyContainer(container.id);
});

describe("Qdrant", () => {
  let client: QdrantClient;

  beforeAll(() => {
    client = new QdrantClient({ url: connectionString });
  });

  it("should create a collection", async () => {
    const result = await client.createCollection("test-vectors", {
      vectors: { size: 4, distance: "Cosine" },
    });
    expect(result).toBeDefined();
  });

  it("should upsert points and search", async () => {
    await client.recreateCollection("search-demo", {
      vectors: { size: 3, distance: "Cosine" },
    });

    await client.upsert("search-demo", {
      points: [
        { id: 1, vector: [1.0, 0.0, 0.0], payload: { label: "red" } },
        { id: 2, vector: [0.0, 1.0, 0.0], payload: { label: "green" } },
        { id: 3, vector: [0.0, 0.0, 1.0], payload: { label: "blue" } },
      ],
    });

    const searchResult = await client.search("search-demo", {
      vector: [1.0, 0.0, 0.0],
      limit: 2,
    });

    expect(searchResult.length).toBe(2);
    expect(searchResult[0].id).toBe(1);
    expect(searchResult[0].payload!.label).toBe("red");
  });

  it("should list collections", async () => {
    await client.createCollection("list-test", {
      vectors: { size: 2, distance: "Euclid" },
    });

    const collections = await client.getCollections();
    const names = collections.collections.map((c: { name: string }) => c.name);
    expect(names).toContain("list-test");
  });
});
