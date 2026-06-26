export interface TrashDBOptions {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  fetch?: typeof fetch;
}

export interface CreateContainerParams {
  engine: string;
  ttlMinutes?: number;
  name?: string;
}

export interface ContainerResponse {
  id: string;
  engine: string;
  port: number;
  connectionString: string;
  createdAt: string;
  ttlMinutes: number;
  name?: string;
  expiresAt?: string;
}

export interface EngineInfo {
  id: string;
  name: string;
  maxTtlMinutes: number;
}

export interface TrashDBError {
  code: number;
  message: string;
}
