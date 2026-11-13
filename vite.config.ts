import { defineConfig } from "vite";

export default defineConfig({
  base: "/blackjack-coach/",
  publicDir: "public",
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: "es2022",
    sourcemap: true,
    assetsInlineLimit: 8192,
  },
});
