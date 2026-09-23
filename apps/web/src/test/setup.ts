import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { i18nReady } from '../i18n';

await i18nReady;

afterEach(() => {
  cleanup();
});
