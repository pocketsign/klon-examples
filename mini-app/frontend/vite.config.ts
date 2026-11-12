import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/authorize": "http://localhost:8080",
      "/callback": "http://localhost:8080",
      "/api": "http://localhost:8080",
    },
  },
});
