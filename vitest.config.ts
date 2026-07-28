import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Deliberately NOT UTC. The team is UTC+4 (Dubai) and the codebase has
    // already shipped one local-time date bug (see school-plan-reset-date.ts).
    // Code that does local-time month arithmetic passes on a UTC CI runner
    // but fails here — that's the point.
    env: { TZ: "Asia/Dubai" },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
