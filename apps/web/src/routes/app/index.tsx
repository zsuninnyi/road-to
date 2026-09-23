import { formatDistanceMeters, formatDurationSeconds } from '@road-to/domain';
import type { Activity, ConnectStravaResponse, Integration } from '@road-to/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { api, meQueryOptions } from '../../auth/session';

export type AppSearch = {
  strava?: 'connected' | 'denied' | 'error';
};

export const Route = createFileRoute('/app/')({
  validateSearch: (search: Record<string, unknown>): AppSearch => {
    const strava = search.strava;
    if (strava === 'connected' || strava === 'denied' || strava === 'error') {
      return { strava };
    }
    return {};
  },
  component: AppPage,
});

export function AppPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { strava } = Route.useSearch();
  const meQuery = useQuery(meQueryOptions());
  const units = meQuery.data?.user.units === 'imperial' ? 'imperial' : 'metric';

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    retry: false,
  });
  const integrationsQuery = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.integrations(),
    retry: false,
  });
  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: () => api.activities(),
    retry: false,
  });

  const stravaIntegration = integrationsQuery.data?.integrations.find(
    (item: Integration) => item.provider === 'strava',
  );
  const activities = activitiesQuery.data?.activities ?? [];

  const connectMutation = useMutation({
    mutationFn: () => api.connectStrava(),
    onSuccess: ({ url }: ConnectStravaResponse) => {
      window.location.assign(url);
    },
  });

  const resyncMutation = useMutation({
    mutationFn: (id: string) => api.resyncIntegration(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t('activities.title')}</h1>
      <p className="mt-3 text-muted">{t('shell.emptyBody')}</p>
      <p className="mt-2 text-sm text-muted">{t('activities.importHint')}</p>

      {strava === 'denied' ? (
        <p className="mt-4 text-sm text-danger">{t('activities.denied')}</p>
      ) : null}
      {strava === 'error' ? (
        <p className="mt-4 text-sm text-danger">{t('activities.callbackError')}</p>
      ) : null}
      {connectMutation.isError ? (
        <p className="mt-4 text-sm text-danger">{t('activities.connectError')}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {stravaIntegration ? (
          <>
            <p className="text-sm text-muted">{t('activities.connected')}</p>
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:text-ink"
              disabled={resyncMutation.isPending}
              onClick={() => void resyncMutation.mutate(stravaIntegration.id)}
            >
              {t('activities.resync')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
            disabled={connectMutation.isPending}
            onClick={() => void connectMutation.mutate()}
          >
            {t('activities.connectStrava')}
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t('activities.empty')}</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-t border-line">
          {activities.map((activity: Activity) => (
            <li
              key={activity.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium">{activity.title}</p>
                <p className="text-sm text-muted">
                  <time dateTime={activity.startedAt}>
                    {new Intl.DateTimeFormat('en', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(new Date(activity.startedAt))}
                  </time>
                  <span className="mx-2">·</span>
                  <span className="capitalize">{activity.sport}</span>
                </p>
              </div>
              <p className="text-sm text-muted">
                {activity.distanceM != null ? formatDistanceMeters(activity.distanceM, units) : '—'}
                {activity.movingTimeS != null
                  ? ` · ${formatDurationSeconds(activity.movingTimeS)}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted">
        {healthQuery.isSuccess ? t('shell.apiOk') : null}
        {healthQuery.isError ? t('shell.apiDown') : null}
      </p>
    </section>
  );
}
