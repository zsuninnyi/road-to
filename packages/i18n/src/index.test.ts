import { describe, expect, it } from 'vitest';
import { defaultNS, en, resources } from './index.js';

describe('i18n catalog', () => {
  it('ships English as the default namespace', () => {
    expect(defaultNS).toBe('common');
    expect(resources.en.common).toBe(en);
  });

  it('includes auth and shell copy used by the app shell', () => {
    expect(en.appName).toBe('RoadTo');
    expect(en.auth.signInWithGoogle).toBeTruthy();
    expect(en.shell.apiOk).toBeTruthy();
    expect(en.shell.apiDown).toBeTruthy();
  });
});
