import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const chunkGroups = {
  "vendor-react": ["react", "react-dom"],
  "vendor-ui": [
    "@radix-ui/react-accordion",
    "@radix-ui/react-alert-dialog",
    "@radix-ui/react-aspect-ratio",
    "@radix-ui/react-avatar",
    "@radix-ui/react-checkbox",
    "@radix-ui/react-collapsible",
    "@radix-ui/react-context-menu",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-hover-card",
    "@radix-ui/react-label",
    "@radix-ui/react-menubar",
    "@radix-ui/react-navigation-menu",
    "@radix-ui/react-popover",
    "@radix-ui/react-progress",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-select",
    "@radix-ui/react-separator",
    "@radix-ui/react-slider",
    "@radix-ui/react-slot",
    "@radix-ui/react-switch",
    "@radix-ui/react-tabs",
    "@radix-ui/react-toast",
    "@radix-ui/react-toggle",
    "@radix-ui/react-toggle-group",
    "@radix-ui/react-tooltip",
    "lucide-react",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ],
  "vendor-markdown": [
    "react-markdown",
    "react-syntax-highlighter",
    "remark-gfm",
    "remark-math",
    "rehype-katex",
    "katex",
  ],
  "vendor-charts": ["recharts"],
  "vendor-canvas": ["konva", "react-konva"],
  "vendor-motion": ["motion"],
  "vendor-query": ["@tanstack/react-query"],
  "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
};

const getManualChunk = (id: string) => {
  if (!id.includes("node_modules")) return undefined;
  for (const [chunkName, packages] of Object.entries(chunkGroups)) {
    if (packages.some((packageName) => id.includes(`/node_modules/${packageName}/`))) {
      return chunkName;
    }
  }
  return undefined;
};

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  server: {
    host: "::",
    port: 3000,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
});
