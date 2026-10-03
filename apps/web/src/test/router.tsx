import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { MeUser } from '@road-to/api-client';
import { routeTree } from '../routeTree.gen';

export const signedInUser: MeUser = {
  id: 'user_1',
  name: 'Viktor',
  email: 'viktor@example.test',
  image: null,
  units: 'metric',
};

export function stubSession(
  user: MeUser | null,
  options: {
    integrations?: unknown[];
    activities?: Array<Record<string, unknown>>;
    activity?: Record<string, unknown>;
  } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/v1/me')) {
        if (!user) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ user }),
        };
      }
      if (url.includes('/v1/integrations/strava/connect')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://www.strava.com/oauth/authorize?client_id=test' }),
        };
      }
      if (url.includes('/v1/integrations')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ integrations: options.integrations ?? [] }),
        };
      }
      if (/\/v1\/activities\/[^/?]+/.test(url)) {
        if (method === 'POST' && url.includes('/resync')) {
          if (!options.activity) {
            return {
              ok: false,
              status: 404,
              json: async () => ({ error: 'Not found' }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => options.activity,
          };
        }
        if (method === 'PATCH') {
          if (!options.activity) {
            return {
              ok: false,
              status: 404,
              json: async () => ({ error: 'Not found' }),
            };
          }
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            description?: string | null;
            title?: string | null;
            visibility?: 'private' | 'public';
          };
          const next = { ...options.activity };
          if (body.description !== undefined) {
            next.description = body.description;
          }
          if (body.title !== undefined) {
            const trimmed = body.title?.trim() ?? '';
            if (trimmed.length === 0) {
              next.title = 'Morning Run';
              next.titleOverridden = false;
            } else {
              next.title = trimmed;
              next.titleOverridden = true;
            }
          }
          if (body.visibility === 'public' || body.visibility === 'private') {
            next.visibility = body.visibility;
          }
          options.activity = next;
          if (options.activities) {
            options.activities = options.activities.map((activity) =>
              activity.id === next.id ? { ...activity, ...next } : activity,
            );
          }
          return {
            ok: true,
            status: 200,
            json: async () => options.activity,
          };
        }
        if (options.activity) {
          return {
            ok: true,
            status: 200,
            json: async () => options.activity,
          };
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        };
      }
      if (url.includes('/v1/activities')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ activities: options.activities ?? [] }),
        };
      }
      if (url.includes('/health')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    }),
  );
}

export async function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    trailingSlash: 'never',
  });

  await router.load();

  return {
    router,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
