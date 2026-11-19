import { createTheme } from '@mui/material/styles'
import { BRAND_COLORS } from './brandColors'

export const getMuiTheme = (mode) => {
  const isDark = mode === 'dark'
  const brand = isDark ? BRAND_COLORS.dark : BRAND_COLORS.light

  return createTheme({
    palette: {
      mode,
      primary: {
        main: brand.primary,
        dark: brand.primaryDark,
        light: brand.primaryLight,
        contrastText: brand.onPrimary,
        container: brand.primaryContainer,
        onContainer: brand.onPrimaryContainer,
      },
      secondary: {
        main: isDark ? '#C4C7C5' : '#444746',
        container: isDark ? '#333538' : '#E1E3E1',
      },
      background: {
        default: isDark ? '#0F0F11' : '#F0F4F9',
        paper: isDark ? '#1E1F20' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E3E3E3' : '#1F1F1F',
        secondary: isDark ? '#C4C7C5' : '#444746',
        disabled: isDark ? '#444746' : '#C4C7C5',
      },
      error: {
        main: isDark ? '#F28B82' : '#C5221F',
        light: isDark ? 'rgba(242, 139, 130, 0.12)' : '#FCE8E6',
        border: isDark ? 'rgba(242, 139, 130, 0.25)' : '#FAD2CF',
      },
      success: {
        main: isDark ? '#81C995' : '#137333',
        light: isDark ? 'rgba(129, 201, 149, 0.12)' : '#E6F4EA',
        border: isDark ? 'rgba(129, 201, 149, 0.25)' : '#CEEAD6',
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    },
    typography: {
      fontFamily: [
        '"Inter Variable"',
        'Inter',
        'system-ui',
        '-apple-system',
        'sans-serif',
      ].join(','),
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      // Page colours come from the --ds-* variables in index.css only.
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: 'var(--ds-surface-dim)',
            color: 'var(--ds-text)',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: '9999px',
            padding: '8px 24px',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
            boxShadow: 'none',
            '@media (prefers-reduced-motion: no-preference)': {
              '&:active': {
                transform: 'scale(0.95)',
              },
            },
          },
          containedPrimary: {
            backgroundColor: 'var(--ds-primary)',
            color: 'var(--ds-on-primary)',
            '&:hover': {
              backgroundColor: 'var(--ds-primary-dark)',
            },
          },
          outlinedPrimary: {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            color: 'var(--ds-primary)',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(var(--ds-primary-rgb), 0.08)' : 'rgba(var(--ds-primary-rgb), 0.04)',
              borderColor: 'var(--ds-primary)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: '16px',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--ds-primary)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--ds-primary)',
              borderWidth: '2px',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 3px 8px -1px rgba(0,0,0,0.04)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
          },
        },
      },
    },
  })
}
