import {describe, it, expect, beforeAll, afterAll} from "vitest";
import { ChromaClient } from "chromadb";
import { db, when } from "./setup.js";
import {ContainerResponse} from "../../../src";

let connectionString: string;
let container: ContainerResponse;

beforeAll(async () => {
  container = await db.createContainer({
    engine: "chromadb",
    ...when(15),
  });
  connectionString = container.connectionString;
});

afterAll(async () => {
  if (container) await db.destroyContainer(container.id);
});

describe("ChromaDB", () => {
  let client: ChromaClient;

  beforeAll(() => {
    client = new ChromaClient({ path: connectionString });
  });

  it("should create a collection", async () => {
    const collection = await client.createCollection({ name: "test-docs" });
    expect(collection.name).toBe("test-docs");
  });

  it("should add vectors and query them", async () => {
    const collection = await client.getOrCreateCollection({ name: "embeddings" });

    await collection.add({
      ids: ["doc1", "doc2", "doc3"],
      embeddings: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      metadatas: [
        { source: "api" },
        { source: "web" },
        { source: "cli" },
      ],
      documents: ["API documentation content", "Web app content", "CLI tool content"],
    });

    const results = await collection.query({
      queryEmbeddings: [[1, 0, 0]],
      nResults: 2,
    });

    expect(results.ids[0].length).toBe(2);
    expect(results.ids[0][0]).toBe("doc1");
    expect(results.metadatas![0]![0]!.source).toBe("api");
  });

  it("should delete collections", async () => {
    await client.createCollection({ name: "temp-collection" });
    await client.deleteCollection({ name: "temp-collection" });

    const names = await client.listCollections();
    expect(names).not.toContain("temp-collection");
  });
});
