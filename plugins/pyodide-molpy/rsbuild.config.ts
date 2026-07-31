import { defineConfig } from "@rsbuild/core";

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.tsx",
    },
  },
  output: {
    target: "web",
    distPath: {
      root: "dist",
      js: "./",
    },
    filename: {
      js: "plugin.js",
    },
    minify: true,
    sourceMap: false,
    cleanDistPath: true,
    injectStyles: true,
  },
  html: {
    template: false as unknown as string,
  },
  tools: {
    swc: {
      jsc: {
        transform: {
          react: {
            runtime: "automatic",
            importSource: "react",
          },
        },
      },
    },
    htmlPlugin: false,
    rspack: {
      output: {
        library: { type: "module" },
        chunkFormat: "module",
        module: true,
      },
      experiments: {
        outputModule: true,
      },
      externalsType: "module",
      externals: {
        react: "react",
        "react-dom": "react-dom",
        "react-dom/client": "react-dom/client",
        "react/jsx-runtime": "react/jsx-runtime",
        "@molcrafts/molvis-core": "@molcrafts/molvis-core",
        "@molvis/core": "@molvis/core",
      },
    },
  },
  performance: {
    chunkSplit: {
      strategy: "all-in-one",
    },
  },
});
