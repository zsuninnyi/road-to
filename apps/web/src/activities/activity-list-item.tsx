import type { Activity } from '@road-to/api-client';
import type { ReactNode } from 'react';
import {
  formatDistanceMeters,
  formatDurationSeconds,
  formatPace,
  type Units,
} from '@road-to/domain';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export function ActivityListItem({
  activity,
  units,
  linked = true,
  action = null,
}: {
  activity: Activity;
  units: Units;
  linked?: boolean;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const pace =
    activity.sport === 'run' && activity.movingTimeS != null && activity.distanceM != null
      ? formatPace(activity.movingTimeS, activity.distanceM, units)
      : null;

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
      <div>
        <p className="font-medium">
          {linked ? (
            <Link
              to="/app/activities/$activityId"
              params={{ activityId: activity.id }}
              className="hover:text-accent"
            >
              {activity.title}
            </Link>
          ) : (
            activity.title
          )}
        </p>
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
          <span className="mx-2">·</span>
          <span>
            {activity.visibility === 'public' ? t('activities.public') : t('activities.private')}
          </span>
        </p>
        {activity.description ? (
          <p className="mt-1 text-sm text-muted">{activity.description}</p>
        ) : null}
        {action}
      </div>
      <p className="text-sm text-muted">
        {activity.distanceM != null ? formatDistanceMeters(activity.distanceM, units) : '—'}
        {activity.movingTimeS != null ? ` · ${formatDurationSeconds(activity.movingTimeS)}` : ''}
        {pace ? ` · ${pace}` : ''}
      </p>
    </li>
  );
}
