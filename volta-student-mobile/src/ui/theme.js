/**
 * Aliniat la volta-frontend/src/styles/design-system.css ([data-theme="light"])
 */
export const colors = {
  brandPrimary: '#FFEE00',
  brandHover: '#FFEE00',
  brandSoft: '#FFEE00',

  black: '#333333',
  nearBlack: '#333333',
  grayDark: '#333333',
  grayMedium: '#333333',
  grayLight: '#FFFFFF',

  bgPrimary: '#333333',
  bgSecondary: '#333333',
  bgTertiary: '#333333',
  bgElevated: '#333333',

  textPrimary: '#FFFFFF',
  textSecondary: '#FFFFFF',
  textTertiary: '#FFFFFF',
  textDisabled: '#FFFFFF',

  borderPrimary: '#333333',
  borderSecondary: '#FFEE00',
  borderFocus: '#FFEE00',

  overlay: 'rgba(51, 51, 51, 0.92)',
  brandA10: 'rgba(255, 238, 0, 0.12)',
  brandA15: 'rgba(255, 238, 0, 0.18)',
  brandA20: 'rgba(255, 238, 0, 0.25)',
  brandA30: 'rgba(255, 238, 0, 0.35)',

  success: '#FFEE00',
  warning: '#FFEE00',
  error: '#FFEE00',

  // Alias-uri folosite în ecranele existente
  bg: '#333333',
  card: '#333333',
  text: '#FFFFFF',
  muted: '#FFFFFF',
  primary: '#FFEE00',
  danger: '#FFEE00',
  border: '#FFEE00',
};

export const spacing = {
  xs: 4,
  sm: 8,
  smd: 10,
  md: 12,
  lg: 16,
  lgx: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  x4l: 48,
  x6l: 64,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  full: 9999,
};

export const typography = {
  size: {
    caption: 11,
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    x2l: 24,
    x3l: 30,
    x4l: 36,
    x5l: 40,
    x6l: 48,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
};

export const shadows = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
};
