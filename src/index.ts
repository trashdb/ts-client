import type {
  TrashDBOptions,
  CreateContainerParams,
  ContainerResponse,
  EngineInfo,
  TrashDBError,
} from "./types.js";

export type {
  TrashDBOptions,
  CreateContainerParams,
  ContainerResponse,
  EngineInfo,
  TrashDBError,
};

/**
 * Official TrashDB Node.js SDK.
 *
 * @example
 * ```ts
 * import { TrashDB } from 'trashdb';
 *
 * const db = new TrashDB({ apiKey: 'your-api-key' });
 *
 * const container = await db.createContainer({
 *   engine: 'chromadb',
 *   ttlMinutes: 5,
 *   name: 'My test DB',
 * });
 *
 * console.log(container.connectionString);
 * // → http://localhost:49823
 * ```
 */
export class TrashDB {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: TrashDBOptions) {
    this.apiKey = options.apiKey;
    // Default to localhost for development.
    // In production, pass your deployed API URL, e.g. 'https://api.trashdb.dev/api/v1'
    this.baseUrl = (options.baseUrl ?? "http://localhost:5000/api/v1").replace(
      /\/$/,
      ""
    );
  }

  // ── Containers ───────────────────────────────────────────────────────────

  /**
   * Create an ephemeral database container.
   * @returns The created container details including its connection string.
   */
  async createContainer(
    params: CreateContainerParams
  ): Promise<ContainerResponse> {
    const res = await fetch(`${this.baseUrl}/containers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        engine: params.engine,
        ttlMinutes: params.ttlMinutes ?? 5,
        name: params.name,
      }),
    });

    if (!res.ok) {
      const error: TrashDBError = await res.json();
      throw new TrashDBAPIError(res.status, error);
    }

    return res.json();
  }

  /**
   * List all running (not yet destroyed) containers for the authenticated tenant.
   */
  async getRunningContainers(): Promise<ContainerResponse[]> {
    const res = await fetch(`${this.baseUrl}/containers`, {
      headers: { "x-api-key": this.apiKey },
    });

    if (!res.ok) {
      const error: TrashDBError = await res.json();
      throw new TrashDBAPIError(res.status, error);
    }

    return res.json();
  }

  /**
   * Destroy a running container immediately.
   * @returns `true` if the container was destroyed.
   */
  async destroyContainer(containerId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/containers/${containerId}`, {
      method: "DELETE",
      headers: { "x-api-key": this.apiKey },
    });

    if (res.status === 204) return true;

    if (!res.ok) {
      const error: TrashDBError = await res.json();
      throw new TrashDBAPIError(res.status, error);
    }

    return true;
  }

  // ── Engines ──────────────────────────────────────────────────────────────

  /**
   * List all supported database engines (public, no auth required).
   */
  async getEngines(): Promise<EngineInfo[]> {
    const res = await fetch(`${this.baseUrl}/engines`);

    if (!res.ok) {
      const error: TrashDBError = await res.json();
      throw new TrashDBAPIError(res.status, error);
    }

    return res.json();
  }
}

// ── Error class ────────────────────────────────────────────────────────────

export class TrashDBAPIError extends Error {
  readonly status: number;
  readonly code: number;

  constructor(status: number, error: TrashDBError) {
    super(error.message);
    this.name = "TrashDBAPIError";
    this.status = status;
    this.code = error.code;
  }
}

