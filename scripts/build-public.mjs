import { build } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function buildPublic() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const common = {
    root,
    configFile: false,
    logLevel: "warn",
    plugins: [svelte({ configFile: false, compilerOptions: { runes: true } })],
    resolve: { alias: { "#shared": `${root}shared` } },
  };
  await build({
    ...common,
    build: {
      ssr: "shared/ui/public-server.ts",
      outDir: ".public-build",
      emptyOutDir: true,
      rolldownOptions: { output: { entryFileNames: "public-page.js" } },
    },
  });
  await build({
    ...common,
    base: "/_public/",
    plugins: [...common.plugins, tailwindcss()],
    build: {
      outDir: "build/_public",
      emptyOutDir: true,
      manifest: true,
      rolldownOptions: { input: "shared/ui/public-client.ts" },
    },
  });
  const manifest = JSON.parse(await readFile(`${root}build/_public/.vite/manifest.json`, "utf8"));
  const entry = manifest["shared/ui/public-client.ts"];
  const assets =
    (entry.css ?? []).map((path) => `<link rel="stylesheet" href="/_public/${path}">`).join("") +
    `<script type="module" src="/_public/${entry.file}"></script>`;
  const server = await readFile(`${root}.public-build/public-page.js`, "utf8");
  await writeFile(
    `${root}worker/generated/public-page.js`,
    server + `\nexport const publicAssets = ${JSON.stringify(assets)};\n`,
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildPublic();
