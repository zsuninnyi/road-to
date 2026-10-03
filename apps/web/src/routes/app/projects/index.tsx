import { sports } from '@road-to/domain';
import type { Project } from '@road-to/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../auth/session';

export const Route = createFileRoute('/app/projects/')({
  component: ProjectsPage,
});

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [sport, setSport] = useState<(typeof sports)[number]>('run');
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.projects(),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createProject({ name: name.trim(), sport }),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
      await navigate({
        to: '/app/projects/$projectId',
        params: { projectId: project.id },
        search: { name: project.name },
      });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    createMutation.mutate();
  }

  const projects = projectsQuery.data?.projects ?? [];

  return (
    <section className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">{t('projects.title')}</h1>
      <p className="mt-3 text-sm text-muted">{t('projects.openHint')}</p>
      <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="text-sm" htmlFor="project-name">
          {t('projects.nameLabel')}
        </label>
        <input
          id="project-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('projects.namePlaceholder')}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="text-sm" htmlFor="project-sport">
          {t('projects.sportLabel')}
        </label>
        <select
          id="project-sport"
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          value={sport}
          onChange={(event) => setSport(event.target.value as (typeof sports)[number])}
        >
          {sports.map((item) => (
            <option key={item} value={item}>
              {t(`sports.${item}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
          disabled={createMutation.isPending}
        >
          {t('projects.create')}
        </button>
      </form>

      {projects.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t('projects.empty')}</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-t border-line">
          {projects.map((project: Project) => (
            <li key={project.id} className="py-3">
              <Link
                to="/app/projects/$projectId"
                params={{ projectId: project.id }}
                search={{ name: project.name }}
                className="font-medium hover:text-accent"
              >
                {project.name}
              </Link>
              <p className="text-sm text-muted">
                {t(`sports.${project.sport as (typeof sports)[number]}`)}
                <span className="mx-2">·</span>
                {project.visibility === 'public' ? t('activities.public') : t('activities.private')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
