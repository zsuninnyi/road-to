export type HealthResponse = {
  ok: true;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string): Promise<T> {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const response = await fetchFn(`${baseUrl}${path}`);
    if (!response.ok) {
      throw new ApiError(response.status, `Request failed: ${response.status} ${path}`);
    }
    return (await response.json()) as T;
  }

  return {
    health(): Promise<HealthResponse> {
      return request<HealthResponse>('/health');
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
