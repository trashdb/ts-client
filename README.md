# @trashdb/ts

Official TypeScript/Node.js SDK for [TrashDB](https://trashdb.dev) — ephemeral database containers on demand.

## Install

```bash
npm install @trashdb/ts
```

## Getting an API key

1. Go to [trashdb.dev/dashboard](https://trashdb.dev/dashboard)
2. Copy your API key from the top of the dashboard
3. Pass it to the client constructor

## Usage

### Quick start

```ts
import { TrashDB } from '@trashdb/ts';

const db = new TrashDB({ apiKey: 'trdb_...' });

const container = await db.createContainer({ engine: 'postgres', ttlMinutes: 10 });
console.log(container.connectionString);
// → postgresql://postgres:...@hosted.trashdb.dev:49823/postgres
```

### Real-world example: integration tests with Vitest

```ts
import { PrismaClient } from '@prisma/client';
import { TrashDB } from '@trashdb/ts';
import { beforeAll, afterAll, test, expect } from 'vitest';

const db = new TrashDB({ apiKey: process.env.TRASHDB_API_KEY! });
let prisma: PrismaClient;

beforeAll(async () => {
  // 1. Spin up a disposable Postgres
  const container = await db.createContainer({ engine: 'postgres', ttlMinutes: 10 });

  // 2. Point Prisma at it (or run raw SQL migrations)
  process.env.DATABASE_URL = container.connectionString;
  prisma = new PrismaClient();
  await prisma.$executeRawUnsafe('CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, name TEXT)');
});

afterAll(async () => {
  await prisma.$disconnect();
});

test('create and find a user', async () => {
  await prisma.user.create({ data: { email: 'ana@test.com', name: 'Ana' } });
  const user = await prisma.user.findUnique({ where: { email: 'ana@test.com' } });
  expect(user?.name).toBe('Ana');
});

// Container auto-destroys after 10 min.
// No cleanup needed — even if the test crashes.
```

### Real-world example: CI pipeline (GitHub Actions)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
        env:
          TRASHDB_API_KEY: ${{ secrets.TRASHDB_API_KEY }}
```

```ts
// test-setup.ts — runs before the test suite
import { TrashDB } from '@trashdb/ts';

const db = new TrashDB({ apiKey: process.env.TRASHDB_API_KEY! });

export async function setupDatabase() {
  const container = await db.createContainer({ engine: 'postgres', ttlMinutes: 15 });
  process.env.DATABASE_URL = container.connectionString;
  // Run your migrations
  await import('./migrate');
}
```

```ts
import { TrashDB } from '@trashdb/ts';

const db = new TrashDB({ apiKey: 'trdb_...' });

// Create a container
const container = await db.createContainer({
  engine: 'chromadb',
  ttlMinutes: 5,
  name: 'my-test-db',
});
console.log(container.connectionString);
// → http://hosted.trashdb.dev:49823

// List running containers
const containers = await db.getRunningContainers();
console.log(containers.length);

// Destroy a container
await db.destroyContainer(container.id);

// List available engines
const engines = await db.getEngines();
```

## API

### `new TrashDB(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | (required) | Your TrashDB API key (`trdb_...`) |
| `baseUrl` | `string` | `https://api.trashdb.dev/api/v1` | API base URL |
| `maxRetries` | `number` | `3` | Max retries on transient errors (502/503/504) |
| `initialBackoffMs` | `number` | `500` | Initial backoff in ms; doubles each retry |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation (e.g. for proxies or tests) |

### Methods

#### `createContainer(params)`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `engine` | `string` | (required) | Engine identifier — `chromadb`, `qdrant`, `redis`, `postgres`, `mongodb`, `supabase` |
| `ttlMinutes` | `number` | `5` | Minutes until the container is auto-destroyed |
| `name` | `string` | — | Optional human-readable label |

Returns `ContainerResponse`:

```ts
{
  id: string;
  engine: string;
  port: number;
  connectionString: string;
  createdAt: string;
  ttlMinutes: number;
  name: string | undefined;
}
```

#### `getRunningContainers()`

Returns `ContainerResponse[]`. Also includes `expiresAt?: string` on each container.

#### `destroyContainer(containerId)`

Returns `true` on success. Throws `TrashDBAPIError` if the container doesn't exist (404) or the request fails.

#### `getEngines()`

Returns `EngineInfo[]`. This endpoint is public — no API key needed.

```ts
{ id: string; name: string; maxTtlMinutes: number }[]
```

## Authentication

TrashDB uses API key authentication. Pass your key via the `apiKey` option:

```ts
const db = new TrashDB({ apiKey: 'trdb_abc123...' });
```

The SDK sends it as the `x-api-key` header on every authenticated request.

## Error handling

All methods throw `TrashDBAPIError` on non-OK responses:

```ts
import { TrashDB, TrashDBAPIError } from '@trashdb/ts';

try {
  await db.createContainer({ engine: 'invalid' });
} catch (err) {
  if (err instanceof TrashDBAPIError) {
    console.error(`[${err.status}] (code ${err.code}) ${err.message}`);
    // → e.g. "[400] (code 1001) Engine 'invalid' is not supported"
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `status` | `number` | HTTP status code (400, 401, 429, etc.) |
| `code` | `number` | TrashDB error code (see docs) |
| `message` | `string` | Human-readable error description |

## Retry behaviour

The SDK automatically retries on **502**, **503** and **504** responses (and network errors). The retry count and backoff are configurable via `maxRetries` and `initialBackoffMs`. Non-retryable errors (4xx, other 5xx) fail immediately.

## License

MIT
