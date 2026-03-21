/** @type {import("jest").Config} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
      },
    }],
  },
};