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

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export class TrashDB {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TrashDBOptions) {
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 500;
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = (options.baseUrl ?? "http://localhost:5000/api/v1").replace(
      /\/$/,
      "",
    );
  }

  createContainer(
    params: CreateContainerParams,
  ): Promise<ContainerResponse> {
    return this.request<ContainerResponse>(`${this.baseUrl}/containers`, {
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
  }

  getRunningContainers(): Promise<ContainerResponse[]> {
    return this.request<ContainerResponse[]>(`${this.baseUrl}/containers`, {
      headers: { "x-api-key": this.apiKey },
    });
  }

  async destroyContainer(containerId: string): Promise<boolean> {
    const res = await this.rawRequest(
      `${this.baseUrl}/containers/${containerId}`,
      { method: "DELETE", headers: { "x-api-key": this.apiKey } },
    );

    if (res.ok) return true;

    const error: TrashDBError = await res.json();
    throw new TrashDBAPIError(res.status, error);
  }

  getEngines(): Promise<EngineInfo[]> {
    return this.request<EngineInfo[]>(`${this.baseUrl}/engines`);
  }

  private async request<T>(
    url: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await this.rawRequest(url, init);

    if (!res.ok) {
      const error: TrashDBError = await res.json();
      throw new TrashDBAPIError(res.status, error);
    }

    return res.json();
  }

  private async rawRequest(
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    const maxAttempts = Math.max(1, this.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await this.fetchImpl(url, init);

        if (attempt === maxAttempts || !RETRYABLE_STATUSES.has(res.status))
          return res;

        await this.sleep(attempt);
      } catch (err) {
        if (attempt === maxAttempts) throw err;

        await this.sleep(attempt);
      }
    }

    throw new Error("Unreachable");
  }

  private async sleep(attempt: number): Promise<void> {
    const delay = this.initialBackoffMs * Math.pow(2, attempt - 1);
    await new Promise((r) => setTimeout(r, delay));
  }
}

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
