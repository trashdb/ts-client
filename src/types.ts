// ── SDK Configuration ─────────────────────────────────────────────────────────

export interface TrashDBOptions {
  /** Your TrashDB API key (x-api-key header). */
  apiKey: string;
  /**
   * Base URL of the TrashDB API.
   * Defaults to 'http://localhost:5000/api/v1' for local development.
   * In production, point this to your deployed API URL.
   */
  baseUrl?: string;
}

// ── Request types ────────────────────────────────────────────────────────────

export interface CreateContainerParams {
  /** Engine identifier, e.g. 'chromadb', 'qdrant', 'redis', 'postgres'. */
  engine: string;
  /** Time-to-live in minutes. Defaults to server-side default if omitted. */
  ttlMinutes?: number;
  /** Optional human-readable name for the container. */
  name?: string;
}

// ── Response types ───────────────────────────────────────────────────────────

export interface ContainerResponse {
  id: string;
  engine: string;
  port: number;
  connectionString: string;
  createdAt: string;
  ttlMinutes: number;
  name?: string;
}

export interface EngineInfo {
  id: string;
  name: string;
  maxTtlMinutes: number;
}

// ── Error types ──────────────────────────────────────────────────────────────

export interface TrashDBError {
  code: number;
  message: string;
}

