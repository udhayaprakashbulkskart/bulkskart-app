import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import fs from "fs";

/** Bump buildTime on each build and sync public/version.json for runtime checks. */
function versionStampPlugin(): Plugin {
  const stamp = () => {
    const buildTime = new Date().toISOString();
    const payload = {
      version: `1.0.2-aws`,
      buildTime,
      gitCommit: "prod-aws-vm",
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    fs.writeFileSync(path.resolve(__dirname, "src/version.json"), json);
    fs.writeFileSync(path.resolve(__dirname, "public/version.json"), json);
    return payload;
  };

  // the folder this build writes to (dist/ unless --outDir says otherwise), so the SEO files land next to its index.html
  let outDir = path.resolve(__dirname, "dist");
  return {
    name: "bulkskart-version-stamp",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    buildStart() {
      stamp();
    },
    async closeBundle() {
      const { generateSeoAssets } = await import("./scripts/generate-seo-assets.mjs");
      await generateSeoAssets(outDir);
    },
  };
}

export default defineConfig({
  plugins: [
    versionStampPlugin(),
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
});
