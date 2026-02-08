import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: ".",
  plugins: [react()],
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "packages/core")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "dist/ui"),
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 4173,
    // Match package.json `api:dev` default port.
    // Override with VITE_API_PROXY_TARGET when needed.
    host: "127.0.0.1",
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:4001"
    }
  }
});
