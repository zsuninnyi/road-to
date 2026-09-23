import { Link, createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();

  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t('appName')}</h1>
      <p className="mt-3 text-muted">{t('tagline')}</p>
      <Link
        to="/login"
        className="mt-8 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
      >
        {t('auth.signIn')}
      </Link>
    </section>
  );
}
