import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderRoute, stubSession } from '../../../test/router';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('shared project', () => {
  it('shows the project and every activity without signing in', async () => {
    stubSession(null);
    await renderRoute('/share/projects/project_1');

    expect(await screen.findByRole('heading', { name: 'Marathon' })).toBeInTheDocument();
    expect(screen.getByText(/Viktor/)).toBeInTheDocument();
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('10.2 km · 58:20 · 5:43 /km')).toBeInTheDocument();
    expect(screen.getAllByText('Marathon — 10.2 km').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });
});
