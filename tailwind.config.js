/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Foundation ─────────────────────────────────────────────
        'kosha-bg':       '#F8F7FF',   // warm white with faintest violet tint
        'kosha-surface':  '#FFFFFF',   // cards
        'kosha-border':   '#EAE8F5',   // card borders — violet tinted
        'kosha-border-strong': '#C4B8F5', // focused inputs, active

        // ── Brand Violet ───────────────────────────────────────────
        'brand':          '#6C47FF',   // primary violet
        'brand-dark':     '#4F2FE8',   // pressed state
        'brand-container':'#EDE8FF',   // chip backgrounds, tonal
        'brand-on':       '#2D1B69',   // text on violet tonal

        // ── Gradient stops (hero card) ─────────────────────────────
        'grad-from':      '#2D1B69',
        'grad-mid':       '#1A0F4E',
        'grad-to':        '#0F0A2E',

        // ── Transaction type colours ───────────────────────────────
        'income':         '#00C896',
        'income-bg':      '#E8FBF6',
        'income-text':    '#006B50',
        'income-border':  '#99EDD9',

        'expense':        '#FF4757',
        'expense-bg':     '#FFE8EA',
        'expense-text':   '#CC0015',
        'expense-border': '#FFB3BA',

        'invest':         '#6C47FF',
        'invest-bg':      '#EDE8FF',
        'invest-text':    '#2D1B69',
        'invest-border':  '#C4B8F5',

        'repay':          '#FF6B9D',
        'repay-bg':       '#FFE8F2',
        'repay-text':     '#8B0038',
        'repay-border':   '#FFB3D1',

        // ── Text ───────────────────────────────────────────────────
        'ink':            '#0F0A2E',   // primary text — deep violet-black
        'ink-2':          '#6B6589',   // secondary — violet grey
        'ink-3':          '#A09CC0',   // muted — placeholders
        'on-grad':        '#FFFFFF',   // text on gradient
        'on-grad-2':      '#C4B8F5',   // subdued text on gradient

        // ── Semantic ───────────────────────────────────────────────
        'warning':        '#F59E0B',
        'warning-bg':     '#FEF3C7',
        'warning-border': '#FCD34D',
        'warning-text':   '#92400E',
        'danger':         '#FF4757',
        'success':        '#00C896',
      },

      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'hero':    ['52px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display': ['28px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'title':   ['20px', { lineHeight: '1.3' }],
        'label':   ['11px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
      },

      borderRadius: {
        'card':  '16px',
        'hero':  '24px',
        'chip':  '8px',
        'pill':  '9999px',
      },

      boxShadow: {
        // Standard card — very subtle
        'card':      '0 1px 4px rgba(108,71,255,0.06), 0 0 0 1px #EAE8F5',
        // Character card — CRED hard shadow (violet tinted)
        'hard':      '3px 3px 0px #D4D0F0, 0 0 0 1px #EAE8F5',
        // Overdue bill — red hard shadow
        'hard-red':  '3px 3px 0px #FFB3BA, 0 0 0 1px #FFE8EA',
        // Due today — amber hard shadow
        'hard-amber':'3px 3px 0px #FCD34D, 0 0 0 1px #FEF3C7',
        // FAB
        'fab':       '0 4px 20px rgba(108,71,255,0.40)',
        // Input focus
        'focus':     '0 0 0 3px rgba(108,71,255,0.15)',
      },

      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '72%':  { transform: 'translateY(-6px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'swipe-out': {
          '0%':   { transform: 'translateX(0)',     opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'count-up': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bar-fill': {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--bar-width)' },
        },
      },
      animation: {
        'sheet-in':  'sheet-in 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'fade-in':   'fade-in 0.2s ease forwards',
        'slide-up':  'slide-up 0.25s ease forwards',
        'swipe-out': 'swipe-out 0.25s ease forwards',
        'count-up':  'count-up 0.6s ease forwards',
        'bar-fill':  'bar-fill 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
}
