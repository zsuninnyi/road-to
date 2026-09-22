import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { routeTree } from '../routeTree.gen';

async function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    trailingSlash: 'never',
  });

  await router.load();

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('brand header', () => {
  it('shows RoadTo when no project is open', async () => {
    await renderRoute('/');
    expect(await screen.findByRole('link', { name: 'RoadTo' })).toBeInTheDocument();
  });

  it('becomes RoadTo {projectName} after creating a project', async () => {
    const user = userEvent.setup();
    await renderRoute('/app/projects');

    await user.type(await screen.findByLabelText('Project name'), 'Marathon');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByRole('link', { name: 'RoadTo Marathon' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marathon' })).toBeInTheDocument();
  });
});
