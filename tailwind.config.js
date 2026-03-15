/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ──────────────────────────────────────────────
        'kosha-bg': '#F5F4FB',   // was #F2F2F7 — slightly warmer, violet tint
        'kosha-bg-2': '#FFFFFF',
        'kosha-surface': '#FFFFFF',
        'kosha-surface-2': '#F5F4FB',
        'kosha-border': '#E8E6F0',   // was #E5E5EA — warmer border
        'kosha-border-strong': '#C9C5D9',   // was #C7C7CC

        // ── Brand — unified violet ────────────────────────────────────────
        'brand': '#6C47FF',   // was #007AFF — THE fix
        'brand-dark': '#5535CC',   // was #0062CC
        'brand-container': '#EEEBFF',   // was #EBF4FF
        'brand-on': '#3B1FAB',   // was #0040A0

        // ── Income — softer, modern green ────────────────────────────────
        'income': '#00C896',   // was #34C759 — teal-green, fresher
        'income-bg': '#E6FAF5',   // was #EDFAF1
        'income-text': '#007A5E',   // was #1A7A35 — less murky
        'income-border': '#99E8D0',   // was #A8E6B8

        // ── Expense — softer red, more readable ──────────────────────────
        'expense': '#FF4757',   // was #FF3B30 — slightly warmer
        'expense-bg': '#FFF0F1',   // was #FFF0EF
        'expense-text': '#D42B3A',   // was #CC0000 — less harsh
        'expense-border': '#FFB3BA',   // was #FFB3AF

        // ── Investment — violet-adjacent blue, on-brand ───────────────────
        'invest': '#7B61FF',   // was #007AFF — now violet family
        'invest-bg': '#F0EEFF',   // was #EBF4FF
        'invest-text': '#4B35CC',   // was #0040A0 — violet not navy
        'invest-border': '#C4BAFF',   // was #99CCFF

        // ── Repayment — warm amber ────────────────────────────────────────
        'repay': '#FF9500',   // unchanged
        'repay-bg': '#FFF5E6',   // unchanged
        'repay-text': '#B35A00',   // was #A05000 — slightly more contrast
        'repay-border': '#FFCC80',   // unchanged

        // ── Ink — slightly warm, not pure black ──────────────────────────
        'ink': '#110C22',   // was #000000 — warm dark violet-black
        'ink-2': '#3D3654',   // was #3C3C43 — warm mid
        'ink-3': '#8C85A8',   // was #8E8E93 — warm grey
        'ink-4': '#C5C0D8',   // was #C7C7CC — warm light

        // ── Utility ──────────────────────────────────────────────────────
        'on-grad': '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'warning': '#FF9500',
        'warning-bg': '#FFF5E6',
        'warning-border': '#FFCC80',
        'warning-text': '#B35A00',
        'success': '#00C896',   // was #34C759 — matches new income
        'danger': '#FF4757',   // was #FF3B30 — matches new expense
      },
      fontFamily: {
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'hero': ['44px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display': ['28px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'title': ['20px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'label': ['11px', { lineHeight: '1.4', letterSpacing: '0.06em' }],
      },
      borderRadius: {
        'card': '16px',
        'card-lg': '20px',
        'hero': '24px',
        'chip': '8px',
        'pill': '9999px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'card-md': '0 4px 16px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'apple-card': '0 20px 60px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.10)',
        'fab': '0 4px 16px rgba(0,122,255,0.35)',
        'focus': '0 0 0 3.5px rgba(0,122,255,0.30)',
        'urgent': '0 2px 8px rgba(255,59,48,0.20), 0 0 0 0.5px rgba(255,59,48,0.15)',
        'warn': '0 2px 8px rgba(255,149,0,0.20), 0 0 0 0.5px rgba(255,149,0,0.15)',
      },
      keyframes: {
        'sheet-in': {
          '0%': { transform: 'translateY(100%)' },
          '72%': { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'swipe-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 0.40s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in': 'fade-in 0.2s ease forwards',
        'slide-up': 'slide-up 0.28s ease forwards',
        'swipe-out': 'swipe-out 0.22s ease forwards',
        'scale-in': 'scale-in 0.22s ease forwards',
      },
    },
  },
  plugins: [],
}