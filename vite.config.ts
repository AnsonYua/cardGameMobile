import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    env.BACKEND_URL ||
    env.VITE_BACKEND_URL ||
    "http://localhost:8080";

  const apiProxy = {
    target: backendUrl,
    changeOrigin: true,
    configure: (proxy: any) => {
      proxy.on("proxyReq", (proxyReq: any) => {
        // Backend CORS middleware may reject unknown browser origins.
        // When the Vite dev/preview server is acting as a reverse proxy, strip the Origin header
        // so the backend treats it as a same-origin/server-side request.
        proxyReq.removeHeader("origin");
      });
    },
  };

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          ...apiProxy,
        },
      },
    },
    preview: {
      allowedHosts: [".ondigitalocean.app", "plankton-app-hc4oo.ondigitalocean.app"],
      proxy: {
        "/api": {
          ...apiProxy,
        },
      },
    },
  };
});
