import { defaultNS, resources } from '@road-to/i18n';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const i18nReady = i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  ns: [defaultNS],
  resources,
  interpolation: { escapeValue: false },
});

export { i18n };
