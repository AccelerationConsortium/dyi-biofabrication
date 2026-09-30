import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const generatedDir = path.join(root, "src/data/generated");
const requiredGenerated = ["papers.json", "tools.json", "skills.json", "stats.json"];

if (requiredGenerated.some((file) => !existsSync(path.join(generatedDir, file)))) {
  console.log("[corpus] Missing generated data — running build-corpus.mjs");
  execSync("node scripts/build-corpus.mjs", { cwd: root, stdio: "inherit" });
}

export default defineConfig({
  site: "https://biofabtoolkit.accelerationconsortium.ai",
  devToolbar: {
    enabled: false
  },
  server: {
    host: true,
    // Allow Tailscale MagicDNS / Funnel hostnames in dev
    allowedHosts: [".ts.net", "localhost"]
  },
  vite: {
    server: {
      allowedHosts: [".ts.net", "localhost"]
    }
  }
});
