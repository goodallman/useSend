import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  banner: { js: "'use client'" },
  dts: true,
  minify: true,
  clean: true,
  external: ["react", "react-dom"],
  injectStyle: true,
  ...options,
}));
