import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login';

const { signInSocial } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
}));

vi.mock('../auth/client', () => ({
  authClient: {
    signIn: { social: signInSocial },
    signOut: vi.fn(),
  },
}));

describe('LoginPage', () => {
  it('starts Google sign-in', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/app',
    });
  });
});
