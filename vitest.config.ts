import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/domain', 'packages/api-client', 'packages/i18n', 'apps/api', 'apps/web'],
  },
});
