import {
  build,
  emptyDir,
} from "https://raw.githubusercontent.com/redabacha/dnt/da5a4139a990f2f9f753acc68d5f3ce045d59f09/mod.ts";

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
