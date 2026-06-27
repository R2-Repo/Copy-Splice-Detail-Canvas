import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

import { SUSPENDED_FROM_FAST_GATE } from "./vitest.slowTests";

/** Default dev/CI gate — fast unit + import tests; no grid feasibility loops. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    maxWorkers: 2,
    exclude: [...configDefaults.exclude, ...SUSPENDED_FROM_FAST_GATE],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
