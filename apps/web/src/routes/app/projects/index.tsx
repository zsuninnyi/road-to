import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/app/projects/')({
  component: ProjectsPage,
});

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projectName = name.trim();
    if (!projectName) {
      return;
    }

    void navigate({
      to: '/app/projects/$projectId',
      params: { projectId: crypto.randomUUID() },
      search: { name: projectName },
    });
  }

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
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
        >
          {t('projects.create')}
        </button>
      </form>
    </section>
  );
}
