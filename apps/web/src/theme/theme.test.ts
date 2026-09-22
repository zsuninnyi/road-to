import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME, applyTheme, getTheme, isThemeName, themeNames } from './index';

describe('default theme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('is named default', () => {
    expect(DEFAULT_THEME).toBe('default');
    expect(themeNames).toEqual(['default']);
    expect(isThemeName('default')).toBe(true);
    expect(isThemeName('dark')).toBe(false);
  });

  it('sets data-theme on the document', () => {
    applyTheme('default');
    expect(document.documentElement.dataset.theme).toBe('default');
    expect(getTheme()).toBe('default');
  });

  it('falls back to default when the attribute is missing', () => {
    expect(getTheme()).toBe('default');
  });
});
