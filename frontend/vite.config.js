import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
            return "vendor-react";
          }

          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
            return "vendor-motion";
          }

          if (id.includes("remotion") || id.includes("@remotion")) {
            return "vendor-remotion";
          }

          if (id.includes("axios") || id.includes("jszip")) {
            return "vendor-utils";
          }

          return "vendor";
        },
      },
    },
  },
})
