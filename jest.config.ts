import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests", "<rootDir>/src", "<rootDir>/apps/ui"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  collectCoverage: false,
  setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"]
};

export default config;
