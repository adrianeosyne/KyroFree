import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const origin = "https://kyro-chat.cyou";

function worker() {
  const listeners = new Map<string, Function>();
  const cached = new Map<string, Response>();
  const key = (request: string | { url: string }) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  let offline = false;
  let body = "fresh";
  let writesFail = false;
  let calls = 0;
  const cache = {
    addAll: async () => {},
    put: async (request: any, response: Response) => {
      if (writesFail) throw new Error("Storage quota exceeded");
      cached.set(key(request), response.clone());
    },
  };
  const context = vm.createContext({
    URL,
    Response,
    caches: {
      open: async () => cache,
      match: async (request: any) => cached.get(key(request))?.clone(),
    },
    self: {
      location: { origin },
      addEventListener: (name: string, handler: Function) =>
        listeners.set(name, handler),
    },
    fetch: async () => {
      calls++;
      if (offline) throw new Error("Offline");
      return new Response(body);
    },
  });
  vm.runInContext(source, context);
  const request = (path: string, extras = {}) => {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: {
        url: new URL(path, origin).href,
        method: "GET",
        mode: "cors",
        cache: "default",
        destination: "",
        ...extras,
      },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    return response;
  };
  return {
    request,
    cached,
    setOffline: () => {
      offline = true;
    },
    setBody: (value: string) => {
      body = value;
    },
    failWrites: () => {
      writesFail = true;
    },
    calls: () => calls,
  };
}

test("mutable manifest and home-screen icons refresh online and remain available offline", async () => {
  const w = worker();
  w.cached.set(`${origin}/manifest.webmanifest`, new Response("old"));
  assert.equal(
    await (await w.request("/manifest.webmanifest")!).text(),
    "fresh",
  );
  w.setBody("new icon");
  assert.equal(
    await (await w.request("/apple-touch-icon.png")!).text(),
    "new icon",
  );
  w.setOffline();
  assert.equal(
    await (await w.request("/manifest.webmanifest")!).text(),
    "fresh",
  );
  assert.equal(
    await (await w.request("/apple-touch-icon.png")!).text(),
    "new icon",
  );
});

test("only hashed build assets are retained; APIs and member media bypass the worker", async () => {
  const w = worker();
  await w.request("/assets/index-Abcd1234.js", { destination: "script" });
  await w.request("/assets/index-Abcd1234.js", { destination: "script" });
  assert.equal(w.calls(), 1);
  for (const path of [
    "/api",
    "/api/bots",
    "/members/avatar.png",
    "/assets/mutable.js",
    "https://another.example/app.js",
  ]) {
    assert.equal(w.request(path, { destination: "image" }), undefined, path);
  }
  assert.equal(
    w.request("/assets/index-Abcd1234.js", {
      cache: "no-store",
      destination: "script",
    }),
    undefined,
  );
});

test("offline navigation shows the retry screen rather than retained account pages", async () => {
  const w = worker();
  w.cached.set(`${origin}/offline.html`, new Response("Check your connection"));
  w.cached.set(`${origin}/dashboard`, new Response("Private account page"));
  w.setOffline();
  assert.equal(
    await (await w.request("/dashboard", { mode: "navigate" })!).text(),
    "Check your connection",
  );
});

test("storage quota failures do not break online installation assets", async () => {
  const w = worker();
  w.failWrites();
  assert.equal(
    await (await w.request("/manifest.webmanifest")!).text(),
    "fresh",
  );
});

test("iPhone home-screen metadata uses local artwork and the established app identity", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../../public/manifest.webmanifest", import.meta.url),
      "utf8",
    ),
  );
  const html = readFileSync(
    new URL("../../index.html", import.meta.url),
    "utf8",
  );
  assert.equal(manifest.id, "/dashboard");
  assert.equal(manifest.start_url, "/dashboard");
  assert.equal(manifest.display, "standalone");
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="Kyro"/);
  assert.match(
    html,
    /rel="apple-touch-icon"[\s\S]*?href="\/apple-touch-icon.png"/,
  );
});
