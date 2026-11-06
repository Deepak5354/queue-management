import { fileURLToPath } from "node:url";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const clientRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: clientRoot,
  plugins: [
    // Generates src/routeTree.gen.ts from the files in src/routes.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 3000,
    strictPort: true,
    // In development the Express API runs on :4000; same-origin calls keep cookies simple.
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
