import { formatDistanceMeters } from '@road-to/domain';
import type { Activity } from '@road-to/api-client';
import { ActivityListItem } from '../../../activities/activity-list-item';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../auth/session';

export const Route = createFileRoute('/share/projects/$projectId')({
  component: SharedProjectPage,
});

function SharedProjectPage() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const projectQuery = useQuery({
    queryKey: ['public-project', projectId],
    queryFn: () => api.publicProject(projectId),
    retry: false,
  });

  if (projectQuery.isError) {
    return (
      <section className="max-w-xl">
        <p className="text-sm text-danger">{t('projects.loadError')}</p>
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
      <p className="mt-2 text-sm text-muted">
        {project.owner.name}
        <span className="mx-2">·</span>
        {t(`sports.${project.sport}`)}
      </p>
      <p className="mt-4 text-sm">
        <span className="text-muted">{t('projects.total')}</span>
        <span className="mx-2">·</span>
        {formatDistanceMeters(project.totalDistanceM, project.units)}
      </p>
      {project.note ? <p className="mt-3 text-sm">{project.note}</p> : null}
      {project.activities.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t('activities.empty')}</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-t border-line">
          {project.activities.map((activity: Activity) => (
            <ActivityListItem
              key={activity.id}
              activity={activity}
              units={project.units}
              linked={false}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
