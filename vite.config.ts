import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig({
  publicDir: false,
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), sites()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (outgoing, incoming) => {
            if (incoming.headers.origin === "http://127.0.0.1:5173")
              outgoing.setHeader("origin", "http://127.0.0.1:8765");
          });
        },
      },
    },
  },
  build: { outDir: "dist/client", target: "es2022", sourcemap: false },
  worker: { format: "es" },
});
