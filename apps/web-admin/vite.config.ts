import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.API_PORT || "3000";
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5180,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
