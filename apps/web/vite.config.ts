import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Hostnames for Vite dev/preview (Host header check). Written by the API when you save
 * Configuration → Portal access. If the file is missing, all hosts are allowed.
 */
function readPortalAllowedHosts(): true | string[] {
  const file = path.resolve(__dirname, "portal-allowed-hosts.json");
  try {
    if (!fs.existsSync(file)) {
      return true;
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as { hosts?: unknown };
    if (Array.isArray(raw.hosts) && raw.hosts.length > 0) {
      return raw.hosts.filter((h): h is string => typeof h === "string" && h.length > 0);
    }
  } catch {
    /* ignore */
  }
  return true;
}

const portalHosts = readPortalAllowedHosts();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tanstackRouter({
    target: 'react',
    autoCodeSplitting: true,
  }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: portalHosts,
  },
  preview: {
    allowedHosts: portalHosts,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
