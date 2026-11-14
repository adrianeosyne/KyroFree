import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

// Test the actual components and the production sandbox bundle without accounts.
const root = process.cwd();
const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-mermaid-tests",
  root,
  plugins: [
    react(),
    tailwind(),
    {
      name: "verification-routes",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === "/mermaid.html" || req.url?.startsWith("/assets/")) {
            const relative = new URL(
              req.url,
              "http://localhost",
            ).pathname.slice(1);
            const file = path.resolve(root, "dist", relative);
            if (!file.startsWith(path.resolve(root, "dist") + path.sep)) {
              res.statusCode = 403;
              res.end();
              return;
            }
            try {
              const bytes = await readFile(file);
              res.setHeader(
                "Content-Type",
                file.endsWith(".html")
                  ? "text/html"
                  : file.endsWith(".css")
                    ? "text/css"
                    : "application/javascript",
              );
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(bytes);
            } catch {
              res.statusCode = 404;
              res.end();
            }
            return;
          }
          if (req.url?.startsWith("/docs") || req.url === "/diagrams")
            req.url = "/tests/mermaid/index.html";
          next();
        });
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(root, "src") },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 4182, strictPort: true },
  optimizeDeps: { entries: ["tests/mermaid/index.html"] },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1360, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(45000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
const diagrams = {
  flowchart: "flowchart TD\nA[Start] --> B[Finish]",
  sequence: "sequenceDiagram\nAlice->>Bob: Hello\nBob-->>Alice: Hi",
  class: "classDiagram\nAnimal <|-- Duck\nAnimal : +int age",
  state: "stateDiagram-v2\n[*] --> Ready\nReady --> [*]",
  er: "erDiagram\nUSER ||--o{ MESSAGE : sends",
  gantt:
    "gantt\n title Project\n dateFormat YYYY-MM-DD\n section Work\n Build :a1, 2026-11-01, 3d",
  journey: "journey\n title My day\n section Work\n Write code: 5: Me",
  git: "gitGraph\n commit\n branch develop\n checkout develop\n commit",
  pie: 'pie title Pets\n"Cats" : 4\n"Dogs" : 3',
  mindmap: "mindmap\n root((Kyro))\n  Chat\n  Bots",
  timeline: "timeline\n title Roadmap\n 2026 : Build\n 2027 : Grow",
  quadrant:
    "quadrantChart\n title Priorities\n x-axis Low --> High\n y-axis Low --> High\n Task: [0.3, 0.6]",
  requirement:
    "requirementDiagram\nrequirement secure {\nid: 1\ntext: Secure system\nrisk: low\nverifymethod: test\n}",
  architecture:
    "architecture-beta\nservice api(server)[API]\nservice db(database)[Database]\napi:R -- L:db",
};
try {
  await page.goto("http://127.0.0.1:4182/diagrams");
  for (const [name, source] of Object.entries(diagrams)) {
    await page.getByLabel("Test source").fill(source);
    const img = page.locator(
      '[data-testid="message"] [aria-label="Mermaid diagram"] img',
    );
    await img.waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-testid="message"] img');
      return image?.complete && image.naturalWidth > 0;
    });
    const svg = await img.evaluate(async (img) =>
      (await fetch(img.src)).text(),
    );
    assert.match(svg, /<svg/);
    if (name === "flowchart")
      assert(
        svg.includes("Start") && svg.includes("Finish"),
        "Flowchart labels must survive sanitization",
      );
    assert(
      !/<script|<foreignObject|onload=|javascript:/i.test(svg),
      `${name}: unsafe SVG`,
    );
    console.log(`Rendered ${name}`);
  }
  await page.getByLabel("Test source").fill(diagrams.flowchart);
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await page.locator('[data-testid="message"] img').waitFor();
  await page.screenshot({
    path: "test-results/mermaid-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Copy source", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      "\n",
    ),
    diagrams.flowchart,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download SVG" }).click();
  await download;
  await page
    .getByRole("button", { name: "Expand diagram", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page
    .getByRole("region", { name: "Pan and zoom diagram" })
    .press("ArrowRight");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await page
    .getByLabel("Test source")
    .fill("flowchart TD\nclick A javascript:alert(1)");
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Test source").fill("flowchart TD\nA --> [");
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Test source").fill("x".repeat(12001));
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Code language").selectOption("javascript");
  assert.equal(
    await page.getByLabel("Mermaid diagram", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Composer", exact: true }).click();
  await page.getByLabel("Diagram template").selectOption("Sequence diagram");
  await page.locator('[role="dialog"] img').waitFor();
  await page
    .getByRole("button", { name: "Add to message", exact: true })
    .click();
  await page.goto("http://127.0.0.1:4182/docs");
  await page
    .getByRole("heading", { name: "Welcome to Kyro Developers", exact: true })
    .waitFor();
  await page.getByLabel("Search documentation").fill("token rotation");
  await page
    .getByRole("link", { name: /Authentication and installation/ })
    .waitFor();
  await page.goto("http://127.0.0.1:4182/docs/api");
  await page
    .getByRole("heading", { name: "REST API reference", exact: true })
    .waitFor();
  assert((await page.locator("main section").count()) > 45);
  await page.screenshot({ path: "test-results/developer-docs-desktop.png" });
  const hrefs = await page
    .locator('a[href^="/docs/"]')
    .evaluateAll((links) => [
      ...new Set(links.map((a) => a.getAttribute("href"))),
    ]);
  for (const href of hrefs) {
    await page.goto(`http://127.0.0.1:4182${href}`);
    assert.equal(
      await page
        .getByText("Documentation page not found", { exact: true })
        .count(),
      0,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4182/docs");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("complementary", { name: "Mobile documentation navigation" })
    .waitFor();
  await page.getByRole("button", { name: "Close navigation" }).click();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.screenshot({ path: "test-results/developer-docs-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Passed 14 diagram types, themes, source/export, zoom, malicious/invalid/oversized input, composer, docs navigation/search/API/mobile.",
  );
} catch (error) {
  console.error("Browser diagnostics:", errors);
  await page
    .screenshot({ path: "test-results/ecosystem-browser-failure.png" })
    .catch(() => undefined);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
