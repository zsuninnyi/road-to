import { formatDistanceMeters } from '@road-to/domain';
import type { Activity } from '@road-to/api-client';
import { useQuery } from '@tanstack/react-query';
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
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
      <p className="mt-2 text-sm text-muted">{t(`sports.${project.sport}`)}</p>
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
            <li key={activity.id} className="py-3">
              <Link
                to="/app/activities/$activityId"
                params={{ activityId: activity.id }}
                className="font-medium hover:text-accent"
              >
                {activity.title}
              </Link>
              {activity.description ? (
                <p className="mt-1 text-sm text-muted">{activity.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
