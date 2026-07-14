import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Path to the Next.js app to load next.config and .env files in the test environment
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}", "<rootDir>/tests/**/*.test.{ts,tsx}"],
  collectCoverageFrom: [
    "src/lib/**/*.{ts,tsx}",
    "!src/lib/**/*.d.ts",
    // Exclude modules that are thin wrappers over external services (Supabase/AI/network).
    "!src/lib/supabase/**",
    "!src/lib/wa/**",
    "!src/lib/ai/gemini.ts",
    "!src/lib/ai/knowledge.ts",
    "!src/lib/ai/prompts.ts",
    // Static demo seed data and the AI/WhatsApp task orchestrator (integration-level).
    "!src/lib/demo-data.ts",
    "!src/lib/tasks/executor.ts",
    "!src/lib/**/*.tsx",
  ],
  clearMocks: true,
};

export default createJestConfig(config);
