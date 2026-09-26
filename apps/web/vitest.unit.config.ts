import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    esbuild: { jsx: "automatic" },
    test: {
      include: ["src/**/*.unit.test.ts"],
    },
  }),
);
