import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:5010"
    }
  },
  build: {
    outDir: "dist"
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.js", "client/**/*.test.js"]
  }
});
