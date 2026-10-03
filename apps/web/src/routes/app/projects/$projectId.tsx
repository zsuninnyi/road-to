import { formatDistanceMeters } from '@road-to/domain';
import type { Activity } from '@road-to/api-client';
import { ActivityListItem } from '../../../activities/activity-list-item';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
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
            <ActivityListItem key={activity.id} activity={activity} units={units} />
          ))}
        </ul>
      )}
    </section>
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
