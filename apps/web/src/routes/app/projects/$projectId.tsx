import { formatDistanceMeters } from '@road-to/domain';
import type { Activity } from '@road-to/api-client';
import { ActivityListItem } from '../../../activities/activity-list-item';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, meQueryOptions } from '../../../auth/session';

export type ProjectSearch = {
  name?: string;
};

export const Route = createFileRoute('/app/projects/$projectId')({
  validateSearch: (search: Record<string, unknown>): ProjectSearch => {
    const name = typeof search.name === 'string' ? search.name.trim() : '';
    return name ? { name } : {};
  },
  component: ProjectPage,
});

function ProjectPage() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const meQuery = useQuery(meQueryOptions());
  const units = meQuery.data?.user.units === 'imperial' ? 'imperial' : 'metric';
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.project(projectId),
    retry: false,
  });

  if (projectQuery.isError) {
    return (
      <section className="max-w-xl">
        <p className="text-sm text-danger">{t('activities.loadError')}</p>
      </section>
    );
  }

  const project = projectQuery.data;
  if (!project) {
    return (
      <section className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t('projects.title')}</h1>
      </section>
    );
  }

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
      <p className="mt-2 text-sm text-muted">{t(`sports.${project.sport}`)}</p>
      <ProjectVisibilityControl projectId={project.id} visibility={project.visibility} />
      <ProjectWindowForm
        projectId={project.id}
        windowStart={project.windowStart}
        windowEnd={project.windowEnd}
      />
      {project.visibility === 'public' ? (
        <p className="mt-4 text-sm">
          <Link
            to="/share/projects/$projectId"
            params={{ projectId: project.id }}
            className="font-medium text-accent"
          >
            {t('projects.shareLink')}
          </Link>
          <span className="mt-1 block text-muted">{t('projects.shareHint')}</span>
        </p>
      ) : null}
      <p className="mt-4 text-sm">
        <span className="text-muted">{t('projects.total')}</span>
        <span className="mx-2">·</span>
        {formatDistanceMeters(project.totalDistanceM, units)}
      </p>
      {project.note ? (
        <p className="mt-3 text-sm">
          <span className="text-muted">{t('projects.note')}</span>
          <span className="mx-2">·</span>
          {project.note}
        </p>
      ) : null}
      {project.activities.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t('activities.empty')}</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-t border-line">
          {project.activities.map((activity: Activity) => (
            <ActivityListItem
              key={activity.id}
              activity={activity}
              units={units}
              action={<RemoveActivityButton projectId={project.id} activityId={activity.id} />}
            />
          ))}
        </ul>
      )}
      {(project.excludedActivities ?? []).length > 0 ? (
        <div className="mt-10">
          <h2 className="text-sm font-medium">{t('projects.removed')}</h2>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {project.excludedActivities.map((activity: Activity) => (
              <ActivityListItem
                key={activity.id}
                activity={activity}
                units={units}
                action={<RestoreActivityButton projectId={project.id} activityId={activity.id} />}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ProjectWindowForm({
  projectId,
  windowStart,
  windowEnd,
}: {
  projectId: string;
  windowStart: string | null;
  windowEnd: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [start, setStart] = useState(windowStart ?? '');
  const [end, setEnd] = useState(windowEnd ?? '');
  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateProject(projectId, {
        windowStart: start || null,
        windowEnd: end || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  useEffect(() => {
    setStart(windowStart ?? '');
    setEnd(windowEnd ?? '');
  }, [windowStart, windowEnd]);

  return (
    <form
      className="mt-4 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate();
      }}
    >
      <p className="text-sm text-muted">{t('projects.windowHint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm" htmlFor="project-window-start">
          {t('projects.from')}
          <input
            id="project-window-start"
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="mt-1 block rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm" htmlFor="project-window-end">
          {t('projects.to')}
          <input
            id="project-window-end"
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="mt-1 block rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-line px-3 py-2 text-sm font-medium"
          disabled={saveMutation.isPending}
        >
          {t('projects.saveWindow')}
        </button>
      </div>
      {saveMutation.isError ? (
        <p className="text-sm text-danger">{t('projects.windowError')}</p>
      ) : null}
    </form>
  );
}

function membershipMutation(projectId: string, activityId: string, restore: boolean) {
  return restore
    ? api.restoreProjectActivity(projectId, activityId)
    : api.excludeProjectActivity(projectId, activityId);
}

function RemoveActivityButton({
  projectId,
  activityId,
}: {
  projectId: string;
  activityId: string;
}) {
  return <MembershipButton projectId={projectId} activityId={activityId} restore={false} />;
}

function RestoreActivityButton({
  projectId,
  activityId,
}: {
  projectId: string;
  activityId: string;
}) {
  return <MembershipButton projectId={projectId} activityId={activityId} restore />;
}

function MembershipButton({
  projectId,
  activityId,
  restore,
}: {
  projectId: string;
  activityId: string;
  restore: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: () => membershipMutation(projectId, activityId, restore),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  return (
    <button
      type="button"
      className="mt-2 text-sm text-muted hover:text-ink"
      disabled={saveMutation.isPending}
      onClick={() => saveMutation.mutate()}
    >
      {restore ? t('projects.addBack') : t('projects.remove')}
    </button>
  );
}

function ProjectVisibilityControl({
  projectId,
  visibility,
}: {
  projectId: string;
  visibility: 'private' | 'public';
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: (value: 'private' | 'public') =>
      api.updateProject(projectId, { visibility: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium" htmlFor="project-visibility">
        {t('projects.visibility')}
      </label>
      <select
        id="project-visibility"
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
        <p className="mt-2 text-sm text-danger">{t('projects.visibilityError')}</p>
      ) : null}
    </div>
  );
}
