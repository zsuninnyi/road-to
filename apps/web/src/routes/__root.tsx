import { formatBrandTitle } from '@road-to/domain';
import { Link, Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
  const title = formatBrandTitle(t('appName'), projectName);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          {title}
        </Link>
        <nav className="flex gap-4 text-sm text-muted">
          <Link to="/app" className="hover:text-ink">
            {t('nav.activities')}
          </Link>
          <Link to="/app/projects" className="hover:text-ink">
            {t('nav.projects')}
          </Link>
          <Link to="/login" className="hover:text-ink">
            {t('auth.signIn')}
          </Link>
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
