import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  loader: { ".css": "copy" },
  esbuildOptions(options) {
    options.assetNames = "[name]";
  },
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
  banner: { js: '"use client";' },
});
