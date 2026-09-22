import en from './locales/en.json' with { type: 'json' };

export const defaultNS = 'common';

export const resources = {
  en: {
    common: en,
  },
} as const;

export type TranslationResources = typeof resources;

export { en };
