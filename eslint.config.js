import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

export default [
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // ── Accessibility (jsx-a11y recommended) ──────────────────────────────
      // The plugin is registered above; here we activate every recommended
      // rule. Rules that fire broadly across component-rich React UIs are
      // downgraded to 'warn' so existing patterns surface incrementally
      // rather than instantly failing CI. All ARIA/semantic rules stay 'error'.
      ...jsxA11y.flatConfigs.recommended.rules,

      // Downgrade high-volume interaction rules to warn for staged adoption
      'jsx-a11y/click-events-have-key-events':          'warn',
      'jsx-a11y/no-static-element-interactions':        'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/mouse-events-have-key-events':          'warn',

      // ── React / Hooks ─────────────────────────────────────────────────────
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
]
