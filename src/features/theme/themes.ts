export type ThemeName =
  | 'indigo'
  | 'dark-blue'
  | 'light-blue'
  | 'high-contrast'
  | 'sunrise'
  | 'light-green'
  | 'orange';

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  primary: string;
  primaryLight: string;
  bg: string;
  swatch: string; // shown in the color picker
}

export const THEMES: ThemeConfig[] = [
  { name: 'indigo',        label: 'Indigo',        primary: '#4f46e5', primaryLight: '#eef2ff', bg: '#f5f3ff', swatch: '#4f46e5' },
  { name: 'dark-blue',     label: 'Dark Blue',     primary: '#1e40af', primaryLight: '#dbeafe', bg: '#eff6ff', swatch: '#1e40af' },
  { name: 'light-blue',    label: 'Sky Blue',      primary: '#0284c7', primaryLight: '#e0f2fe', bg: '#f0f9ff', swatch: '#0284c7' },
  { name: 'high-contrast', label: 'High Contrast', primary: '#111827', primaryLight: '#f3f4f6', bg: '#ffffff', swatch: '#111827' },
  { name: 'sunrise',       label: 'Sunrise',       primary: '#dc2626', primaryLight: '#fee2e2', bg: '#fff7ed', swatch: '#dc2626' },
  { name: 'light-green',   label: 'Forest',        primary: '#15803d', primaryLight: '#dcfce7', bg: '#f0fdf4', swatch: '#15803d' },
  { name: 'orange',        label: 'Amber',         primary: '#c2410c', primaryLight: '#ffedd5', bg: '#fffbeb', swatch: '#f59e0b' },
];

export const DEFAULT_THEME: ThemeName = 'indigo';

export function getTheme(name: ThemeName): ThemeConfig {
  return THEMES.find(t => t.name === name) ?? THEMES[0];
}

export function applyTheme(name: ThemeName): void {
  const t = getTheme(name);
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-light', t.primaryLight);
  root.style.setProperty('--bg', t.bg);
}
