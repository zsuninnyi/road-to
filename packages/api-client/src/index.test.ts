import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './index.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('createApiClient', () => {
  it('strips a trailing slash from the base URL', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: 'http://example.test/api/', fetch: fetchFn });

    await client.health();

    expect(fetchFn).toHaveBeenCalledWith('http://example.test/api/health');
  });

  it('returns health payloads', async () => {
    const client = createApiClient({
      baseUrl: 'http://example.test',
      fetch: vi.fn().mockResolvedValue(jsonResponse({ ok: true })),
    });

    await expect(client.health()).resolves.toEqual({ ok: true });
  });

  it('throws ApiError when the response is not ok', async () => {
    const client = createApiClient({
      baseUrl: 'http://example.test',
      fetch: vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 503)),
    });

    await expect(client.health()).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    });
    await expect(client.health()).rejects.toBeInstanceOf(ApiError);
  });
});
