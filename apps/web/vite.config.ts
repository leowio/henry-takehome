import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
  optimizeDeps: {
    exclude: ["@henrylabs-interview/payments"],
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      external: ["@henrylabs-interview/payments"],
    },
  },
});
