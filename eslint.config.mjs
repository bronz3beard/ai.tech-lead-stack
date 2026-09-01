import nextConfig from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  // Add custom overrides here if needed
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['src/mcp-server/**/*.{ts,tsx}', 'src/lib/ai/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/*', '@/components/*', 'next', 'next/*', 'react', 'react-dom'],
              message: 'The core (mcp-server, lib/ai) must remain dashboard-free and cannot import Next.js/React code.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
