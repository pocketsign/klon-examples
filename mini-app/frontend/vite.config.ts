import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // .env は backend と共有するため mini-app/ 直下に置く
  envDir: "..",
  server: {
    proxy: {
      "/authorize": "http://localhost:8080",
      "/callback": "http://localhost:8080",
      "/api": "http://localhost:8080",
    },
  },
});
