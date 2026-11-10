import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    environment: "node",
    // wang fills are ~10 ms/area, goldens + oracle tests do a few full fills;
    // keep ample headroom for slower WSL-mount access to game data.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // one worker at a time: the data-gated suites each hold multi-GB worlds.
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
