import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, webkit } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import { checkMobile } from "../tests/ui/mobile-checks.mjs";

// Shared product screens with isolated data; no production accounts are used.
const server = await createServer({
  configFile: false,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "ios-web-fixture",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (/^\/(dashboard|auth|download)(\/|\?|$)/.test(req.url ?? "")) {
            req.url = "/tests/ui/index.html";
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@/hooks/use-auth", replacement: path.resolve("tests/ui/auth.js") },
      { find: "convex/react", replacement: path.resolve("tests/ui/convex.js") },
      { find: "@", replacement: path.resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 5187, strictPort: true, preTransformRequests: false },
  optimizeDeps: {
    entries: ["tests/ui/index.html"],
    include: ["react", "react-dom/client", "react/jsx-runtime", "react-router"],
  },
});

await fs.mkdir("test-results", { recursive: true });
await server.listen();
try {
  for (const [name, engine] of [["Chromium", chromium], ["WebKit", webkit]]) {
    const browser = await engine.launch({ headless: true });
    try {
      await checkMobile(browser);
      console.log(`PASS: ${name} mobile app compatibility`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
