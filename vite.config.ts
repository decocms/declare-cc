import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss(), TanStackRouterVite()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  server: {
    port: 4200,
    proxy: {
      "/api": "http://localhost:3847",
      "/events": "http://localhost:3847",
    },
  },
  build: {
    outDir: "dist/client",
  },
});
