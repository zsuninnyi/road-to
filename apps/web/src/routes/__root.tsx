import { Outlet, createRootRouteWithContext, Link } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            {t('appName')}
          </Link>
          <nav className="flex gap-4 text-sm text-muted">
            <Link to="/app" className="hover:text-ink">
              {t('nav.activities')}
            </Link>
            <Link to="/login" className="hover:text-ink">
              {t('auth.signIn')}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
