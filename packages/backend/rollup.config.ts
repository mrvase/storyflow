import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import { defineConfig } from "rollup";

export default defineConfig([
  {
    plugins: [esbuild({ minify: true })],
    output: [
      {
        file: `dist/index.js`,
        format: "cjs",
      },
      {
        file: `dist/index.mjs`,
        format: "es",
      },
    ],
    input: "index.ts",
    external: (id) => !/^[./]/.test(id),
  },
  {
    plugins: [dts()],
    output: {
      file: `dist/index.d.ts`,
      format: "es",
    },
    input: "index.ts",
    external: (id) => !/^[./]/.test(id),
  },
]);
