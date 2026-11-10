import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const NO_STORAGE = 'The public site stores nothing in the browser.'

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
      // No auth, no tokens, no storage on the public site.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: NO_STORAGE },
        { name: 'sessionStorage', message: NO_STORAGE },
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis'].flatMap((object) =>
          ['localStorage', 'sessionStorage'].map((property) => ({
            object,
            property,
            message: NO_STORAGE,
          })),
        ),
        { object: 'document', property: 'cookie', message: NO_STORAGE },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/web/**', '**/web/src/**', '@echo/web', '@echo/web/*'],
              message: 'Never import code from apps/web. Copy what is needed.',
            },
          ],
        },
      ],
    },
  },
  {
    // Same rule for the lib, tests and e2e files.
    files: ['src/lib/events.ts', '**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/web/**', '**/web/src/**', '@echo/web', '@echo/web/*'],
              message: 'Never import code from apps/web. Copy what is needed.',
            },
          ],
        },
      ],
    },
  },
)
