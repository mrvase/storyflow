import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import { defineConfig } from "rollup";

export default defineConfig([
  {
    plugins: [esbuild({ minify: true })],
    output: [
      {
        dir: "dist",
        format: "es",
        preserveModules: true,
      },
    ],
    input: {
      index: "index.ts",
      builder: "builder/index.ts",
      config: "config/index.tsx",
    },
    external: (id) => {
      return !/^[./]/.test(id);
    },
  },
  // We need to drop minification for files with the
  // 'use client' directive as banner.
  {
    plugins: [esbuild()],
    output: [
      {
        dir: "dist",
        format: "es",
        preserveModules: true,
        banner: "'use client';",
      },
    ],
    input: {
      "src/RenderContext": "src/RenderContext.tsx",
    },
    external: (id) => {
      return !/^[./]/.test(id);
    },
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
  {
    plugins: [dts()],
    output: {
      file: `dist/config.d.ts`,
      format: "es",
    },
    input: "config/index.tsx",
    external: (id) => !/^[./]/.test(id),
  },
  {
    plugins: [dts()],
    output: {
      file: `dist/builder.d.ts`,
      format: "es",
    },
    input: "builder/index.ts",
    external: (id) => !/^[./]/.test(id),
  },
]);
