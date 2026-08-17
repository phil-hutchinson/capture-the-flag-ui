import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen beyond localhost so the dev server is reachable from the host
    // browser when running inside the dev container.
    host: true,
    // The dev container mounts the workspace over 9p/drvfs (the Windows drive
    // passed through WSL2), which does not implement recursive inotify. Vite
    // watches via fs.watch({ recursive: true }), so without polling it never
    // sees an edit and HMR never fires. node_modules is excluded from the
    // watcher by default, so the cost stays limited to project sources.
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    environment: "node",
  },
});
