import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: [
      "tests/advanced/**/*.test.ts",
      "tests/bots/**/*.test.ts",
      "tests/premium/**/*.test.ts",
      "tests/io/**/*.test.ts",
      "tests/email/**/*.spec.ts",
      "tests/legal/**/*.test.ts",
      "tests/community/**/*.test.ts",
    ],
    environment: "node",
    testTimeout: 20000,
    pool: "forks",
  },
});
