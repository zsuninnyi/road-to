import { createFileRoute, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { authClient } from '../auth/client';
import { meQueryOptions } from '../auth/session';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    if (me) {
      throw redirect({ to: '/app' });
    }
  },
  component: LoginPage,
});

export function LoginPage() {
  const { t } = useTranslation();

  function onGoogle() {
    void authClient.signIn.social({
      provider: 'google',
      callbackURL: '/app',
    });
  }

  return (
    <section className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.signIn')}</h1>
      <p className="mt-3 text-sm text-muted">{t('auth.googleHint')}</p>
      <button
        type="button"
        onClick={onGoogle}
        className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
      >
        {t('auth.signInWithGoogle')}
      </button>
    </section>
  );
}
