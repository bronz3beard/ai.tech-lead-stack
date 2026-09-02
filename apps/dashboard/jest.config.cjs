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
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(next-auth|openid-client|jose|@panva/hkdf|preact|preact-render-to-string|@modelcontextprotocol|octokit|@octokit)/)',
  ],
};
