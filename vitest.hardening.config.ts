import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

import { SUSPENDED_FROM_FAST_GATE } from "./vitest.slowTests";

/** Opt-in layout/routing rule validation — can take tens of minutes. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    testTimeout: 600_000,
    hookTimeout: 600_000,
    pool: "forks",
    maxWorkers: 1,
    include: [...SUSPENDED_FROM_FAST_GATE],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
