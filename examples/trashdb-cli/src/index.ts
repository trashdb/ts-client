#!/usr/bin/env node
import "dotenv/config";
import { TrashDB, TrashDBAPIError } from "@trashdb/ts";
import { probeConnection } from "./connectors.js";

const API_KEY = process.env.TRASHDB_API_KEY;
const BASE_URL = process.env.TRASHDB_BASE_URL;

function getClient(): TrashDB {
  if (!API_KEY) {
    console.error("❌ TRASHDB_API_KEY environment variable is required");
    console.error("   Get one at https://trashdb.dev/dashboard");
    process.exit(1);
  }
  return new TrashDB({
    apiKey: API_KEY,
    ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
  });
}

function printDivider() {
  console.log("─".repeat(50));
}

async function cmdEngines() {
  const db = getClient();
  console.log("🔧 Available engines:\n");
  const engines = await db.getEngines();
  for (const e of engines) {
    console.log(`  ${e.id.padEnd(12)} ${e.name.padEnd(30)} max TTL: ${e.maxTtlMinutes}m`);
  }
}

async function cmdCreate(engine: string, ttl: string, name?: string) {
  const db = getClient();
  const ttlMinutes = parseInt(ttl, 10) || 5;
  printDivider();
  console.log(`🚀 Creating ${engine} container (TTL: ${ttlMinutes}m)${name ? ` — "${name}"` : ""}...`);

  const container = await db.createContainer({ engine, ttlMinutes, ...(name ? { name } : {}) });

  console.log(`\n  ✅ Created!`);
  console.log(`  ID:               ${container.id}`);
  console.log(`  Engine:           ${container.engine}`);
  console.log(`  Port:             ${container.port}`);
  console.log(`  Connection:       ${container.connectionString}`);
  console.log(`  TTL:              ${container.ttlMinutes}m`);
  if (container.name) console.log(`  Name:             ${container.name}`);
  console.log(`  Created at:       ${container.createdAt}`);
  printDivider();

  console.log("\n🔌 Probing connection...");
  try {
    const result = await probeConnection(engine, container.connectionString);
    console.log(`  ${result}`);
  } catch (err) {
    console.error(`  ⚠️  Connection probe failed: ${err}`);
  }
  printDivider();
}

async function cmdList() {
  const db = getClient();
  const containers = await db.getRunningContainers();

  if (containers.length === 0) {
    console.log("📭 No running containers.");
    return;
  }

  console.log(`📦 ${containers.length} running container(s):\n`);
  for (const c of containers) {
    const expires = c.expiresAt ? ` (expires ${new Date(c.expiresAt).toLocaleTimeString()})` : "";
    console.log(`  [${c.id}] ${c.engine} on port ${c.port}${expires}`);
    if (c.name) console.log(`         Name: ${c.name}`);
    console.log(`         ${c.connectionString}`);
  }
}

async function cmdDestroy(containerId: string) {
  const db = getClient();
  console.log(`🗑️  Destroying container ${containerId}...`);
  await db.destroyContainer(containerId);
  console.log("  ✅ Destroyed successfully.");
}

async function cmdQuery(engine: string, containerId: string) {
  const db = getClient();
  const containers = await db.getRunningContainers();
  const container = containers.find((c) => c.id === containerId || c.id.startsWith(containerId));

  if (!container) {
    console.error(`❌ Container "${containerId}" not found.`);
    process.exit(1);
  }

  console.log(`🔌 Connecting to ${container.engine} container ${container.id}...\n`);
  const result = await probeConnection(engine || container.engine, container.connectionString);
  console.log(`  ${result}`);
}

async function cmdDemo() {
  const db = getClient();
  const engine = "postgres";

  printDivider();
  console.log("🧪 TRASHDB DEMO — Full workflow\n");
  console.log(`Step 1: Create a ${engine} container...`);
  const container = await db.createContainer({ engine, ttlMinutes: 10, name: "trashdb-cli-demo" });
  console.log(`        ✅ ${container.id} on port ${container.port}`);

  console.log(`\nStep 2: Connect and run SQL...`);
  try {
    const result = await probeConnection(engine, container.connectionString);
    console.log(`        ${result}`);
  } catch (err) {
    console.error(`        ⚠️  ${err}`);
  }

  console.log(`\nStep 3: List running containers...`);
  const all = await db.getRunningContainers();
  console.log(`        ${all.length} container(s) running`);

  console.log(`\nStep 4: Destroy the container...`);
  await db.destroyContainer(container.id);
  console.log(`        ✅ Destroyed`);

  console.log(`\nStep 5: Verify it's gone...`);
  const remaining = await db.getRunningContainers();
  const found = remaining.find((c) => c.id === container.id);
  console.log(`        ${found ? "⚠️ Still exists" : "✅ Confirmed destroyed"}`);
  printDivider();
  console.log("🎉 Demo complete!");
}

async function showHelp() {
  console.log(`
Usage:
  trashdb-cli engines                              List available engines
  trashdb-cli create <engine> [--ttl <min>] [--name <label>]  Create a container
  trashdb-cli list                                 List running containers
  trashdb-cli destroy <container-id>               Destroy a container
  trashdb-cli query <engine> <container-id>         Connect and run a probe query
  trashdb-cli demo                                 Run full demo workflow

Environment:
  TRASHDB_API_KEY=trdb_...   (required)
  TRASHDB_BASE_URL=...       (optional, default: https://api.trashdb.dev/api/v1)

Engines: postgres, redis, mongodb, chromadb, qdrant, supabase
`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  try {
    switch (cmd) {
      case "engines":
        await cmdEngines();
        break;
      case "create": {
        const engine = args[1];
        if (!engine) {
          console.error("❌ Usage: trashdb-cli create <engine> [--ttl <min>] [--name <label>]");
          process.exit(1);
        }
        const ttlIdx = args.indexOf("--ttl");
        const ttl = ttlIdx !== -1 ? args[ttlIdx + 1] : "5";
        const nameIdx = args.indexOf("--name");
        const name = nameIdx !== -1 ? args[nameIdx + 1] : undefined;
        await cmdCreate(engine, ttl, name);
        break;
      }
      case "list":
        await cmdList();
        break;
      case "destroy": {
        const id = args[1];
        if (!id) {
          console.error("❌ Usage: trashdb-cli destroy <container-id>");
          process.exit(1);
        }
        await cmdDestroy(id);
        break;
      }
      case "query": {
        const engine = args[1];
        const id = args[2];
        if (!engine || !id) {
          console.error("❌ Usage: trashdb-cli query <engine> <container-id>");
          process.exit(1);
        }
        await cmdQuery(engine, id);
        break;
      }
      case "demo":
        await cmdDemo();
        break;
      default:
        await showHelp();
    }
  } catch (err) {
    if (err instanceof TrashDBAPIError) {
      console.error(`❌ API Error [${err.status}] (code ${err.code}): ${err.message}`);
    } else {
      console.error(`❌ Error:`, err);
    }
    process.exit(1);
  }
}

main();
