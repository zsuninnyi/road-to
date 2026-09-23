import { formatBrandTitle } from '@road-to/domain';
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { authClient } from '../auth/client';
import { meQueryKey, meQueryOptions } from '../auth/session';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function useCurrentProjectName(): string | undefined {
  return useRouterState({
    select: (state) => {
      const match = state.matches.find((item) => item.routeId === '/app/projects/$projectId');
      const name = (match?.search as { name?: string } | undefined)?.name;
      const trimmed = name?.trim();
      return trimmed ? trimmed : undefined;
    },
  });
}

export function AppHeader({ projectName }: { projectName?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const meQuery = useQuery(meQueryOptions());
  const user = meQuery.data?.user;
  const title = formatBrandTitle(t('appName'), projectName);

  useEffect(() => {
    document.title = title;
  }, [title]);

  async function onSignOut() {
    await authClient.signOut();
    queryClient.setQueryData(meQueryKey, null);
    await router.navigate({ to: '/' });
  }

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          {title}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link to="/app" className="hover:text-ink">
            {t('nav.activities')}
          </Link>
          <Link to="/app/projects" className="hover:text-ink">
            {t('nav.projects')}
          </Link>
          {user ? (
            <button type="button" className="hover:text-ink" onClick={() => void onSignOut()}>
              {t('auth.signOut')}
            </button>
          ) : (
            <Link to="/login" className="hover:text-ink">
              {t('auth.signIn')}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function RootLayout() {
  const projectName = useCurrentProjectName();

  return (
    <div className="min-h-screen">
      <AppHeader projectName={projectName} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
