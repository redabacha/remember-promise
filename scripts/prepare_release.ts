import {
  build,
  emptyDir,
} from "https://raw.githubusercontent.com/denoland/dnt/2d1d120df7f110c510c6d2aa07e9d0886855e182/mod.ts";

const version = Deno.args[0];

if (version) {
  await Deno.writeTextFile(
    "deno.jsonc",
    (
      await Deno.readTextFile("deno.jsonc")
    ).replace(/"version": ".*"/, `"version": "${version}"`),
  );
}

await emptyDir("./npm");
await build({
  compilerOptions: {
    emitDecoratorMetadata: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
    sourceMap: true,
    target: "ES2022",
  },
  declarationMap: true,
  entryPoints: ["./mod.ts"],
  esModule: false,
  skipNpmInstall: true,
  test: false,
  outDir: "./npm",
  shims: {},
  package: {
    name: "remember-promise",
    version,
    author: "Reda Bacha",
    description: "Remembering promises that were made!",
    repository: "https://github.com/redabacha/remember-promise.git",
    license: "MIT",
    sideEffects: false,
  },
  async postBuild() {
    await Promise.all([
      Deno.copyFile("LICENSE", "npm/LICENSE"),
      Deno.copyFile("README.md", "npm/README.md"),
    ]);
  },
});
