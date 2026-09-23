export const themeNames = ['default'] as const;
export type ThemeName = (typeof themeNames)[number];

export const DEFAULT_THEME: ThemeName = 'default';

export function isThemeName(value: string | undefined): value is ThemeName {
  return themeNames.some((name) => name === value);
}

export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}

export function getTheme(root: HTMLElement = document.documentElement): ThemeName {
  const value = root.dataset.theme;
  return isThemeName(value) ? value : DEFAULT_THEME;
}
