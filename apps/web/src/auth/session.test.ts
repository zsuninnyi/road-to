import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@road-to/api-client';
import { meQueryOptions } from './session';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('meQueryOptions', () => {
  it('returns the session when /v1/me succeeds', async () => {
    const payload: MeResponse = {
      user: {
        id: 'user_1',
        name: 'Viktor',
        email: 'viktor@example.test',
        image: null,
        units: 'metric',
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(queryClient.fetchQuery(meQueryOptions())).resolves.toEqual(payload);
  });

  it('treats a failed /v1/me as signed out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(queryClient.fetchQuery(meQueryOptions())).resolves.toBeNull();
  });
});
