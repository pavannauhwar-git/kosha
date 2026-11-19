import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

// Every rule is an error. Violations that predate this are frozen in
// eslint-suppressions.json; after fixing one, run `npm run lint:prune`.
function asError(setting) {
  if (setting === 'warn' || setting === 1) return 'error'
  if (Array.isArray(setting) && (setting[0] === 'warn' || setting[0] === 1)) return ['error', ...setting.slice(1)]
  return setting
}

const allErrors = (rules) => Object.fromEntries(Object.entries(rules).map(([name, setting]) => [name, asError(setting)]))

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
    rules: allErrors({
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      'react/prop-types': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // React Compiler rules. Like every 'warn' entry here, allErrors()
      // raises them to errors.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',

      // ── Accessibility (jsx-a11y recommended) ──────────────────────────────
      // The plugin is registered above; here we activate every recommended
      // rule.
      ...jsxA11y.flatConfigs.recommended.rules,

      // Interaction rules without the preset's handler lists, so mouse-leave
      // and similar handlers count too.
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
      'react/jsx-uses-vars': 'error', // marks JSX component refs as "used" so imports aren't false-positives
    }),
  },
  {
    // Apply UI primitive guardrails everywhere except the primitives themselves
    files: ['src/pages/**/*.{js,jsx}', 'src/components/**/*.{js,jsx}'],
    ignores: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mui/material/SwipeableDrawer',
              message: 'Use <Sheet> from src/components/ui/Sheet.jsx instead. See .cursor/rules/ui-primitives.mdc',
            },
            {
              name: '@radix-ui/react-dialog',
              message: 'Use <Sheet> from src/components/ui/Sheet.jsx instead. See .cursor/rules/ui-primitives.mdc',
            },
          ],
          patterns: [
            {
              group: ['**/components/ui/BottomSheet', '*/components/ui/BottomSheet'],
              message: 'BottomSheet is deprecated. Use <Sheet> from src/components/ui/Sheet.jsx instead.',
            },
          ],
        },
      ],
    },
  },
]
