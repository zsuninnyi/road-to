import { createApiClient } from '@road-to/api-client';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

const api = createApiClient({ baseUrl: '/api' });

export const Route = createFileRoute('/app')({
  component: AppPage,
});

export function AppPage() {
  const { t } = useTranslation();
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    retry: false,
  });

  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t('shell.emptyTitle')}</h1>
      <p className="mt-3 text-muted">{t('shell.emptyBody')}</p>
      <p className="mt-6 text-sm text-muted">
        {healthQuery.isSuccess ? t('shell.apiOk') : null}
        {healthQuery.isError ? t('shell.apiDown') : null}
      </p>
    </section>
  );
}
