import adapter from "@sveltejs/adapter-static";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { buildPublic } from "./scripts/build-public.mjs";

export default defineConfig({
  plugins: [
    {
      name: "public-svelte-pages",
      configureServer(server) {
        let pending = Promise.resolve();
        server.watcher.on("change", (file) => {
          if (file.includes("/shared/ui/") || file.endsWith("/src/app.css")) {
            pending = pending
              .then(() => buildPublic())
              .catch((error: unknown) => server.config.logger.error(String(error)));
          }
        });
      },
    },
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      adapter: adapter({ pages: "build", assets: "build", strict: true }),
      inlineStyleThreshold: 100_000,
      output: { bundleStrategy: "split" },
    }),
  ],
  server: {
    proxy: {
      "/api": { target: "http://localhost:8787", ws: true },
      "/auth": { target: "http://localhost:8787" },
      "/_public": { target: "http://localhost:8787" },
      "/f": { target: "http://localhost:8787" },
    },
  },
});
