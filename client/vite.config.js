import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const validProductionApiOrigin = (value) => {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  } catch {
    return false;
  }
};

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };

  if (mode === "production") {
    if (!String(env.VITE_GOOGLE_CLIENT_ID || "").trim()) {
      throw new Error("VITE_GOOGLE_CLIENT_ID is required for the production client build.");
    }
    if (!validProductionApiOrigin(env.VITE_API_ORIGIN)) {
      throw new Error("VITE_API_ORIGIN must be a HTTPS origin only, for example https://api.example.com (no /api path).");
    }
  }

  const devApiTarget = String(env.DEV_API_TARGET || "http://localhost:5000")
    .trim()
    .replace(/\/+$/, "");

  return {
    plugins: [react(), tailwindcss()],
    server:
      mode === "development"
        ? {
            proxy: {
              "/api": {
                target: devApiTarget,
                changeOrigin: true,
              },
              "/socket.io": {
                target: devApiTarget,
                changeOrigin: true,
                ws: true,
              },
            },
          }
        : undefined,
    build: {
      sourcemap: false,
      reportCompressedSize: true,
    },
  };
});
