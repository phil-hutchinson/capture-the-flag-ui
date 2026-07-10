import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen beyond localhost so the dev server is reachable from the host
    // browser when running inside the dev container.
    host: true,
  },
  test: {
    environment: "node",
  },
});
