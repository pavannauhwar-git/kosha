/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── One UI pure contrast base ─────────────────────────────────────
        'oneui-white': '#FFFFFF',
        'oneui-black': '#000000',
        'oneui-ink': '#05070B',
        'oneui-surface': '#FFFFFF',
        'oneui-surface-2': '#F6F8FC',
        'oneui-glass-light': '#FFFFFFCC',
        'oneui-glass-dark': '#000000CC',
        'oneui-border': '#D7DFEE',
        'oneui-border-strong': '#A9B9D8',

        // ── App backgrounds (mapped to One UI values) ────────────────────
        'kosha-bg':            '#FFFFFF',
        'kosha-bg-2':          '#F6F8FC',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F6F8FC',
        'kosha-surface-variant': '#F0F4FC',
        'kosha-surface-container': '#E9EFFA',
        'kosha-border':        '#D7DFEE',
        'kosha-border-strong': '#A9B9D8',

        // ── Brand — Samsung-like vivid blue system ───────────────────────
        'brand':           '#1A73FF',
        'brand-dark':      '#0956D6',
        'brand-mid':       '#4E93FF',
        'brand-bg':        '#E8F0FF',
        'brand-container': '#DCE9FF',
        'brand-on':        '#0A2A66',
        'brand-accent':    '#17D6FF',

        // ── One UI accent ramp ────────────────────────────────────────────
        'oneui-blue': '#1A73FF',
        'oneui-cyan': '#17D6FF',
        'oneui-green': '#00C77F',
        'oneui-amber': '#FFB020',
        'oneui-pink': '#FF3FA4',

        // ── Income ────────────────────────────────────────────────────────
        'income':        '#059669',
        'income-bg':     '#ECFDF5',
        'income-text':   '#047857',
        'income-border': '#A7F3D0',

        // ── Expense ───────────────────────────────────────────────────────
        'expense':        '#E11D48',
        'expense-bg':     '#FFF1F2',
        'expense-text':   '#BE123C',
        'expense-border': '#FECDD3',

        // ── Investment ────────────────────────────────────────────────────
        'invest':        '#FF1DCE',
        'invest-bg':     '#FBEFF5',
        'invest-text':   '#7F2A52',
        'invest-border': '#E9BFD2',

        // ── Repayment / Bills ─────────────────────────────────────────────
        'repay':        '#CA8A04',
        'repay-bg':     '#FEFCE8',
        'repay-text':   '#A16207',
        'repay-border': '#FEF08A',

        // ── Warning ───────────────────────────────────────────────────────
        'warning':        '#D97706',
        'warning-bg':     '#FFFBEB',
        'warning-border': '#FDE68A',
        'warning-text':   '#B45309',

        // ── Ink — indigo-tinted neutrals ──────────────────────────────────
        'ink':   '#1F255F',
        'ink-2': '#313A86',
        'ink-3': '#6E75A8',
        'ink-4': '#A0A7CD',

        // ── Utility ───────────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'success':   '#059669',
        'danger':    '#E11D48',
      },

      fontFamily: {
        display: ['SamsungOne', 'Samsung Sharp Sans', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans:    ['SamsungOne', 'Samsung Sharp Sans', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'caption': ['12px', { lineHeight: '1.4',  letterSpacing: '0.01em'  }],
        'label':   ['14px', { lineHeight: '1.4',  letterSpacing: '0em'     }],
        'body':    ['16px', { lineHeight: '1.5',  letterSpacing: '0em'     }],
        'value':   ['20px', { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
        'display': ['28px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'hero':    ['36px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },

      borderRadius: {
        'squircle': '24px',
        'sheet': '32px',
        'card':    '24px',
        'card-lg': '28px',
        'hero':    '24px',
        'chip':    '9999px',
        'pill':    '9999px',
      },

      boxShadow: {
        'glass':      '0 18px 44px rgba(3,12,30,0.20), 0 1px 0 rgba(255,255,255,0.65) inset, 0 0 0 1px rgba(200,214,238,0.50)',
        'glass-dark': '0 20px 46px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.10) inset',
        'card':       '0 2px 7px rgba(18,28,74,0.06), 0 0 0 0.5px rgba(18,28,74,0.08)',
        'card-md':    '0 4px 14px rgba(18,28,74,0.10), 0 0 0 0.5px rgba(18,28,74,0.08)',
        'card-lg':    '0 8px 24px rgba(18,28,74,0.14), 0 0 0 0.5px rgba(18,28,74,0.08)',
        'apple-card': '0 20px 48px rgba(30,27,75,0.18), 0 8px 20px rgba(30,27,75,0.10)',
        'fab':        '0 4px 14px rgba(47,59,206,0.36)',
        'focus':      '0 0 0 3px rgba(36,59,175,0.30)',
        'urgent':     '0 2px 8px rgba(225,29,72,0.20), 0 0 0 0.5px rgba(225,29,72,0.15)',
        'warn':       '0 2px 8px rgba(202,138,4,0.20), 0 0 0 0.5px rgba(202,138,4,0.15)',
      },

      backdropBlur: {
        'oneui': '22px',
        'oneui-strong': '30px',
      },

      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '72%':  { transform: 'translateY(-4px)'  },
          '100%': { transform: 'translateY(0)'     },
        },
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'swipe-out': {
          '0%':   { transform: 'translateX(0)',     opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },
      animation: {
        'sheet-in':  'sheet-in 0.30s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in':   'fade-in 0.2s ease forwards',
        'slide-up':  'slide-up 0.22s ease forwards',
        'swipe-out': 'swipe-out 0.22s ease forwards',
        'scale-in':  'scale-in 0.18s ease forwards',
      },
    },
  },
  plugins: [],
}
