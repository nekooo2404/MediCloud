import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/medicloud-agent-company/src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
