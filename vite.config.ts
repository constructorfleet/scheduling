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
    proxy: {
      "/api": "http://localhost:4000"
    }
  }
});
