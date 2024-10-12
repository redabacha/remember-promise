import { build, emptyDir } from "@deno/dnt";

const version = Deno.args[0];

if (version) {
  await Deno.writeTextFile(
    "deno.json",
    (
      await Deno.readTextFile("deno.json")
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
