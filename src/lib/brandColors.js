// Brand colours as hex for code that needs real colour values: MUI computes
// tints and contrast from its palette, which CSS variables can't feed.
// src/index.css defines the same values as --ds-* variables, and
// scripts/tests/unit/lib/brandColors.test.js fails if the two drift apart.
export const BRAND_COLORS = {
  light: {
    primary: '#0B57D0',
    primaryDark: '#0842A0',
    primaryLight: '#A8C7FA',
    primaryContainer: '#D3E3FD',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#041E49',
  },
  dark: {
    primary: '#3A8BFF',
    primaryDark: '#7AB4FF',
    primaryLight: '#0B57D0',
    primaryContainer: '#003F8A',
    onPrimary: '#001A41',
    onPrimaryContainer: '#D6E8FF',
  },
}

export const BRAND_CSS_VARIABLES = {
  primary: '--ds-primary',
  primaryDark: '--ds-primary-dark',
  primaryLight: '--ds-primary-light',
  primaryContainer: '--ds-primary-container',
  onPrimary: '--ds-on-primary',
  onPrimaryContainer: '--ds-on-primary-container',
}
