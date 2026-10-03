import {
  formatCalories,
  formatDistanceMeters,
  formatDurationSeconds,
  formatPace,
  formatSpeedMps,
} from '@road-to/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityMap } from '../../../activities/map';
import { Sparkline } from '../../../activities/sparkline';
import { api, meQueryOptions } from '../../../auth/session';

export const Route = createFileRoute('/app/activities/$activityId')({
  component: ActivityDetailPage,
});

function ActivityDetailPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activityId } = Route.useParams();
  const meQuery = useQuery(meQueryOptions());
  const units = meQuery.data?.user.units === 'imperial' ? 'imperial' : 'metric';
  const activityQuery = useQuery({
    queryKey: ['activity', activityId],
    queryFn: () => api.activity(activityId),
    retry: false,
  });
  const resyncMutation = useMutation({
    mutationFn: () => api.resyncActivity(activityId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
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
      <h1 className="sr-only">{activity.title}</h1>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <ActivityTitleForm
          activityId={activity.id}
          title={activity.title}
          titleOverridden={activity.titleOverridden}
        />
        <span className="mt-7 rounded-md border border-line px-2 py-0.5 text-xs font-medium">
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
      <ActivityVisibilityControl activityId={activity.id} visibility={activity.visibility} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:text-ink"
          disabled={resyncMutation.isPending}
          onClick={() => void resyncMutation.mutate()}
        >
          {t('activities.resyncActivity')}
        </button>
        {resyncMutation.isError ? (
          <p className="text-sm text-danger">{t('activities.resyncActivityError')}</p>
        ) : null}
      </div>

      <ActivityNoteForm activityId={activity.id} description={activity.description} />

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

function ActivityVisibilityControl({
  activityId,
  visibility,
}: {
  activityId: string;
  visibility: 'private' | 'public';
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: (value: 'private' | 'public') =>
      api.updateActivity(activityId, { visibility: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium" htmlFor="activity-visibility">
        {t('activities.visibility')}
      </label>
      <select
        id="activity-visibility"
        className="mt-2 rounded-md border border-line bg-surface px-3 py-2 text-sm"
        value={visibility}
        disabled={saveMutation.isPending}
        onChange={(event) => {
          const value = event.target.value === 'public' ? 'public' : 'private';
          saveMutation.mutate(value);
        }}
      >
        <option value="private">{t('activities.private')}</option>
        <option value="public">{t('activities.public')}</option>
      </select>
      {saveMutation.isError ? (
        <p className="mt-2 text-sm text-danger">{t('activities.visibilityError')}</p>
      ) : null}
    </div>
  );
}

function ActivityTitleForm({
  activityId,
  title,
  titleOverridden,
}: {
  activityId: string;
  title: string;
  titleOverridden: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const saveMutation = useMutation({
    mutationFn: (value: string | null) => api.updateActivity(activityId, { title: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate(draft.trim() === '' ? null : draft.trim());
      }}
    >
      <label className="block text-sm font-medium" htmlFor="activity-title">
        {t('activities.titleLabel')}
      </label>
      <input
        id="activity-title"
        className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-2xl font-semibold tracking-tight"
        maxLength={255}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
          disabled={saveMutation.isPending}
        >
          {t('activities.saveTitle')}
        </button>
        {titleOverridden ? (
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(null)}
          >
            {t('activities.useProviderTitle')}
          </button>
        ) : null}
        {saveMutation.isSuccess ? (
          <p className="text-sm text-muted">{t('activities.descriptionSaved')}</p>
        ) : null}
        {saveMutation.isError ? (
          <p className="text-sm text-danger">{t('activities.titleError')}</p>
        ) : null}
      </div>
    </form>
  );
}

function ActivityNoteForm({
  activityId,
  description,
}: {
  activityId: string;
  description: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(description ?? '');

  useEffect(() => {
    setDraft(description ?? '');
  }, [description]);

  const saveMutation = useMutation({
    mutationFn: (value: string) =>
      api.updateActivity(activityId, { description: value.trim() === '' ? null : value.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  return (
    <form
      className="mt-6"
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate(draft);
      }}
    >
      <label className="block text-sm font-medium" htmlFor="activity-description">
        {t('activities.description')}
      </label>
      <textarea
        id="activity-description"
        className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
        rows={4}
        maxLength={4000}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t('activities.descriptionPlaceholder')}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
          disabled={saveMutation.isPending}
        >
          {t('activities.saveDescription')}
        </button>
        {saveMutation.isSuccess ? (
          <p className="text-sm text-muted">{t('activities.descriptionSaved')}</p>
        ) : null}
        {saveMutation.isError ? (
          <p className="text-sm text-danger">{t('activities.descriptionError')}</p>
        ) : null}
      </div>
    </form>
  );
}
