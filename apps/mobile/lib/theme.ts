export const colors = {
  primary: '#1D9E75',
  primaryLight: '#E8F5F0',
  accent: '#EF9F27',
  accentLight: '#FDF3E2',
  danger: '#D85A30',
  dangerLight: '#FBEAE4',

  white: '#FFFFFF',
  black: '#000000',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E2E8F0',

  textPrimary: '#1A202C',
  textSecondary: '#718096',
  textMuted: '#A0AEC0',

  unreadDot: '#D85A30',
  success: '#38A169',
  warning: '#EF9F27',
  info: '#3182CE',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  title: 34,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;
