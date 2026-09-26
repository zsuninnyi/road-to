import {
  formatCalories,
  formatDistanceMeters,
  formatDurationSeconds,
  formatPace,
  formatSpeedMps,
} from '@road-to/domain';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ActivityMap } from '../../../activities/map';
import { Sparkline } from '../../../activities/sparkline';
import { api, meQueryOptions } from '../../../auth/session';

export const Route = createFileRoute('/app/activities/$activityId')({
  component: ActivityDetailPage,
});

function ActivityDetailPage() {
  const { t } = useTranslation();
  const { activityId } = Route.useParams();
  const meQuery = useQuery(meQueryOptions());
  const units = meQuery.data?.user.units === 'imperial' ? 'imperial' : 'metric';
  const activityQuery = useQuery({
    queryKey: ['activity', activityId],
    queryFn: () => api.activity(activityId),
    retry: false,
  });

  if (activityQuery.isError) {
    return (
      <section className="max-w-2xl">
        <Link to="/app" className="text-sm text-muted hover:text-ink">
          {t('activities.back')}
        </Link>
        <p className="mt-4 text-sm text-danger">{t('activities.loadError')}</p>
      </section>
    );
  }

  const activity = activityQuery.data;
  if (!activity) {
    return (
      <section className="max-w-2xl">
        <Link to="/app" className="text-sm text-muted hover:text-ink">
          {t('activities.back')}
        </Link>
      </section>
    );
  }

  const latlng = activity.streams?.latlng ?? null;
  const hasTrack = (latlng !== null && latlng.length > 1) || Boolean(activity.mapPolyline);
  const pace =
    activity.sport === 'run' && activity.movingTimeS != null && activity.distanceM != null
      ? formatPace(activity.movingTimeS, activity.distanceM, units)
      : null;

  return (
    <section className="max-w-2xl">
      <Link to="/app" className="text-sm text-muted hover:text-ink">
        {t('activities.back')}
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{activity.title}</h1>
        <span className="rounded-md border border-line px-2 py-0.5 text-xs font-medium">
          {t('activities.sourceStrava')}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        <time dateTime={activity.startedAt}>
          {new Intl.DateTimeFormat('en', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(activity.startedAt))}
        </time>
        <span className="mx-2">·</span>
        <span className="capitalize">{activity.sport}</span>
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">{t('activities.distance')}</dt>
          <dd>
            {activity.distanceM != null ? formatDistanceMeters(activity.distanceM, units) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t('activities.duration')}</dt>
          <dd>
            {activity.movingTimeS != null ? formatDurationSeconds(activity.movingTimeS) : '—'}
          </dd>
        </div>
        {pace ? (
          <div>
            <dt className="text-muted">{t('activities.pace')}</dt>
            <dd>{pace}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted">{t('activities.elevation')}</dt>
          <dd>
            {activity.elevationGainM != null
              ? formatDistanceMeters(activity.elevationGainM, units)
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t('activities.avgHr')}</dt>
          <dd>{activity.avgHr != null ? `${activity.avgHr} bpm` : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('activities.maxHr')}</dt>
          <dd>{activity.maxHr != null ? `${activity.maxHr} bpm` : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('activities.calories')}</dt>
          <dd>{activity.calories != null ? formatCalories(activity.calories) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('activities.speed')}</dt>
          <dd>
            {activity.avgSpeedMps != null ? formatSpeedMps(activity.avgSpeedMps, units) : '—'}
          </dd>
        </div>
      </dl>

      {hasTrack ? (
        <ActivityMap latlng={latlng} polyline={activity.mapPolyline} />
      ) : (
        <p className="mt-6 text-sm text-muted">{t('activities.noMap')}</p>
      )}

      {activity.streams?.altitudeM ? (
        <Sparkline values={activity.streams.altitudeM} label={t('activities.elevationChart')} />
      ) : null}
      {activity.streams?.heartrate ? (
        <Sparkline values={activity.streams.heartrate} label={t('activities.hrChart')} />
      ) : null}
    </section>
  );
}
