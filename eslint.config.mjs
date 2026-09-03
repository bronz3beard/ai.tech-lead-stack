import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = tseslint.defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: [
      'packages/core/src/mcp-server/**/*.{ts,tsx}',
      'packages/core/src/lib/ai/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app/*',
                '@/components/*',
                'next',
                'next/*',
                'next-auth',
                'next-auth/*',
                'react',
                'react-dom',
              ],
              message:
                'The core (mcp-server, lib/ai) must remain dashboard-free and cannot import Next.js/React code.',
            },
          ],
        },
      ],
    },
  }
);

export default eslintConfig;
