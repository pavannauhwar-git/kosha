/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ──────────────────────────────────────────────
        'kosha-bg': '#F5F4FB',
        'kosha-bg-2': '#FFFFFF',
        'kosha-surface': '#FFFFFF',
        'kosha-surface-2': '#F5F4FB',
        'kosha-border': '#E8E6F0',
        'kosha-border-strong': '#C9C5D9',

        // ── Brand — violet ────────────────────────────────────────────────
        'brand': '#6C47FF',
        'brand-dark': '#5535CC',
        'brand-container': '#EEEBFF',
        'brand-on': '#3B1FAB',

        // ── Income ────────────────────────────────────────────────────────
        'income': '#00C896',
        'income-bg': '#E6FAF5',
        'income-text': '#007A5E',
        'income-border': '#99E8D0',

        // ── Expense ───────────────────────────────────────────────────────
        'expense': '#FF4757',
        'expense-bg': '#FFF0F1',
        'expense-text': '#D42B3A',
        'expense-border': '#FFB3BA',

        // ── Investment ────────────────────────────────────────────────────
        'invest': '#7B61FF',
        'invest-bg': '#F0EEFF',
        'invest-text': '#4B35CC',
        'invest-border': '#C4BAFF',

        // ── Repayment ─────────────────────────────────────────────────────
        'repay': '#FF9500',
        'repay-bg': '#FFF5E6',
        'repay-text': '#B35A00',
        'repay-border': '#FFCC80',

        // ── Ink ───────────────────────────────────────────────────────────
        'ink': '#110C22',
        'ink-2': '#3D3654',
        'ink-3': '#8C85A8',
        'ink-4': '#C5C0D8',

        // ── Utility ───────────────────────────────────────────────────────
        'on-grad': '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'warning': '#FF9500',
        'warning-bg': '#FFF5E6',
        'warning-border': '#FFCC80',
        'warning-text': '#B35A00',
        'success': '#00C896',
        'danger': '#FF4757',
      },
      fontFamily: {
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'system-ui', 'sans-serif'],
        sans:    ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text',    'Inter', 'system-ui', 'sans-serif'],
      },

      // ── 6-step type scale — nothing else should be used ──────────────
      // caption  12px  timestamps, tertiary labels
      // label    14px  card labels, chips, secondary text
      // body     16px  list items, descriptions, default prose
      // value    20px  card amounts, section totals
      // display  28px  page headings, hero numbers on cards
      // hero     36px  running balance on the hero card only
      fontSize: {
        'caption': ['12px', { lineHeight: '1.4',  letterSpacing: '0.01em'  }],
        'label':   ['14px', { lineHeight: '1.4',  letterSpacing: '0em'     }],
        'body':    ['16px', { lineHeight: '1.5',  letterSpacing: '0em'     }],
        'value':   ['20px', { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
        'display': ['28px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'hero':    ['36px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },

      borderRadius: {
        'card':    '16px',
        'card-lg': '20px',
        'hero':    '24px',
        'chip':    '8px',
        'pill':    '9999px',
      },
      boxShadow: {
        'card':       '0 2px 8px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'card-md':    '0 4px 16px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'card-lg':    '0 8px 32px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'apple-card': '0 20px 60px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.10)',
        'fab':        '0 4px 16px rgba(108,71,255,0.35)',
        'focus':      '0 0 0 3.5px rgba(108,71,255,0.30)',
        'urgent':     '0 2px 8px rgba(255,59,48,0.20), 0 0 0 0.5px rgba(255,59,48,0.15)',
        'warn':       '0 2px 8px rgba(255,149,0,0.20), 0 0 0 0.5px rgba(255,149,0,0.15)',
      },
      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '72%':  { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(0)' },
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
        'sheet-in':  'sheet-in 0.40s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in':   'fade-in 0.2s ease forwards',
        'slide-up':  'slide-up 0.28s ease forwards',
        'swipe-out': 'swipe-out 0.22s ease forwards',
        'scale-in':  'scale-in 0.22s ease forwards',
      },
    },
  },
  plugins: [],
}
