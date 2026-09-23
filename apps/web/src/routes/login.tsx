import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

export function LoginPage() {
  const { t } = useTranslation();

  return (
    <section className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.signIn')}</h1>
      <p className="mt-3 text-sm text-muted">{t('auth.comingSoon')}</p>
      <button
        type="button"
        disabled
        className="mt-6 cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm text-muted"
      >
        {t('auth.signInWithGoogle')}
      </button>
    </section>
  );
}
