/** @type {import("jest").Config} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/scripts/.*\\.test\\.mjs$',
    '<rootDir>/peripherals/.*\\.test\\.ts$'
  ],
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@zenithfoundry/tech-lead-stack/db$': '<rootDir>/../../packages/core/src/lib/prisma.ts',
    '^@zenithfoundry/tech-lead-stack/crypto$': '<rootDir>/../../packages/core/src/lib/crypto.ts',
    '^@zenithfoundry/tech-lead-stack/telemetry-service$': '<rootDir>/../../packages/core/src/lib/telemetry-service.ts',
    '^@zenithfoundry/tech-lead-stack/trace-utils$': '<rootDir>/../../packages/core/src/lib/trace-utils.ts',
    '^@zenithfoundry/tech-lead-stack/(.*)$': '<rootDir>/../../packages/core/src/lib/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          rootDir: '.',

          jsx: 'react-jsx',
          rootDir: '.',
          // ai@7 / @ai-sdk/*@4 ship ESM .js only; ts-jest must compile them.
          allowJs: true,
        },
      },
    ],
  },
  // A file is skipped when this matches. ai, @ai-sdk/* and @workflow/serde (the
  // ESM-only packages in the AI SDK tree) are let through in both pnpm path
  // forms: node_modules/.pnpm/<pkg>@<ver>/... and node_modules/<pkg>/...
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/(ai|@ai-sdk\\+[a-z0-9-]+|@workflow\\+[a-z0-9-]+)@|(ai|@ai-sdk|@workflow|next-auth|openid-client|jose|@panva/hkdf|preact|preact-render-to-string|@modelcontextprotocol|octokit|@octokit)/))',
  ],
};
