// Bundles the API (and the workspace packages it imports) into one file for deployment.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  // Provided by the Azure Functions host at runtime; must not be bundled.
  external: ["@azure/functions-core"],
  // Lets bundled CommonJS dependencies call require() from inside an ES module.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
