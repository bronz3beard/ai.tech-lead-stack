/** @type {import("jest").Config} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", {
      tsconfig: {
        ignoreDeprecations: "6.0",
        rootDir: ".",

        jsx: "react-jsx",
      },
    }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(next-auth|openid-client|jose|@panva/hkdf|preact|preact-render-to-string|@modelcontextprotocol)/)"
  ],
};
