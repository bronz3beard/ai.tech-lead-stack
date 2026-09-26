/**
 * Jest config for root-level script tests written against Jest globals
 * (scripts/__tests__/*.test.ts). The node:test suites (*.test.mjs) run under
 * `node --test`; `pnpm run test:scripts` runs both, and CI runs that.
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', esModuleInterop: true } },
    ],
  },
};
