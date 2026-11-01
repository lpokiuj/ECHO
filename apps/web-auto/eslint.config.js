import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', '.screens', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
      'no-alert': 'error',
      // The token lives in sessionStorage only (PLAN Auth token decision).
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use the session store; never localStorage.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'Use the session store; never localStorage.',
        },
        {
          object: 'globalThis',
          property: 'localStorage',
          message: 'Use the session store; never localStorage.',
        },
      ],
    },
  },
)
