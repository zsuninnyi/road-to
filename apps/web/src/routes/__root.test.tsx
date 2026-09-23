import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute, signedInUser, stubSession } from '../test/router';
import userEvent from '@testing-library/user-event';
import { cleanup, screen } from '@testing-library/react';

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue({}),
}));

vi.mock('../auth/client', () => ({
  authClient: {
    signIn: { social: vi.fn() },
    signOut,
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('brand header', () => {
  it('shows RoadTo when no project is open', async () => {
    stubSession(null);
    await renderRoute('/');
    expect(await screen.findByRole('link', { name: 'RoadTo' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0);
  });

  it('becomes RoadTo {projectName} after creating a project', async () => {
    stubSession(signedInUser);
    const user = userEvent.setup();
    await renderRoute('/app/projects');

    await user.type(await screen.findByLabelText('Project name'), 'Marathon');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByRole('link', { name: 'RoadTo Marathon' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marathon' })).toBeInTheDocument();
  });

  it('shows sign out when a session exists', async () => {
    stubSession(signedInUser);
    await renderRoute('/app');
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});

describe('protected app routes', () => {
  it('sends guests from /app to login', async () => {
    stubSession(null);
    await renderRoute('/app');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
