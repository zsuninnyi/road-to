import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

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
  const { name } = Route.useSearch();
  const title = name ?? t('projects.title');

  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted">{t('shell.emptyBody')}</p>
    </section>
  );
}
