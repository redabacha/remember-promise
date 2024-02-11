import {
  build,
  emptyDir,
} from "https://raw.githubusercontent.com/redabacha/dnt/c5cf12d21794fc8e4315668ddfd96c1a46695e0c/mod.ts";

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
    declarationMap: true,
    emitDecoratorMetadata: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
    sourceMap: true,
    target: "ES2022",
  },
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
