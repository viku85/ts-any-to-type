const esbuild = require("esbuild");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });

    build.onEnd((result) => {
      if (result.errors.length > 0) {
        console.error(
          `[watch] Build finished with ${result.errors.length} errors:`
        );
        result.errors.forEach(({ text, location }) => {
          console.error(`💥 [ERROR] ${text}`);
          if (location) {
            console.error(
              `    ${location.file}:${location.line}:${location.column}:`
            );
          }
        });
      } else {
        console.log("[watch] build finished successfully");
      }
    });
  },
};

async function main() {
  try {
    const entryPoint = path.resolve("src/extension.ts");
    const outputFile = path.resolve("dist/extension.js");
    console.log(`Building entry point: ${entryPoint}`);
    console.log(`Output will be written to: ${outputFile}`);

    const ctx = await esbuild.context({
      entryPoints: ["src/extension.ts"],
      bundle: true,
      format: "cjs",
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      platform: "node",
      outfile: "dist/extension.js",
      external: ["vscode"],
      logLevel: "silent",
      plugins: [esbuildProblemMatcherPlugin],
    });

    if (watch) {
      console.log("Entering watch mode...");
      await ctx.watch();
    } else {
      await ctx.rebuild();
      console.log("Build completed.");
      await ctx.dispose();
    }
  } catch (e) {
    console.error("Build failed:", e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
