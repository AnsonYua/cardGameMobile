import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: [".ondigitalocean.app", "plankton-app-hc4oo.ondigitalocean.app"],
  },
});
