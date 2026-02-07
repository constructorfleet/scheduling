import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests", "<rootDir>/packages/core", "<rootDir>/apps/ui"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  collectCoverage: false,
  setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"],
  moduleNameMapper: {
    "^@core/(.*)$": "<rootDir>/packages/core/$1"
  }
};

export default config;
