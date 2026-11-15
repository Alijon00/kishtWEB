/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // maplibre-gl is ~1 MB minified (284 kB gzip) in its own chunk — a single,
    // known, cache-isolated vendor lib, so lift the warning just above it rather
    // than letting an unavoidable notice clutter every build.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Split the big third-party libs into their own chunks so no single
        // bundle trips Vite's 500 kB warning and the browser can cache them
        // independently of our app code.
        manualChunks: {
          leaflet: ["leaflet", "react-leaflet"],
          charts: ["recharts"],
          maplibre: ["maplibre-gl"],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
