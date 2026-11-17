import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const originals = Object.fromEntries(
  ["window", "document"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
);
let session = 0;

async function browser(standalone = false) {
  const media = Object.assign(new EventTarget(), { matches: false });
  const fakeWindow = Object.assign(new EventTarget(), {
    navigator: { standalone },
    matchMedia: () => media,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: new EventTarget(),
  });
  const app = await import(`../../src/lib/installApp.ts?session=${session++}`);
  return { app, media, fakeWindow };
}

afterEach(() => {
  for (const key of ["window", "document"]) {
    if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test("iPhone home-screen launches are recognized without an install prompt", async () => {
  const { app } = await browser(true);
  assert.equal(app.getInstallState().installed, true);
  assert.equal(app.getInstallState().prompt, null);
});

test("Safari browser visits remain eligible for the manual home-screen guide", async () => {
  const { app } = await browser();
  assert.equal(app.getInstallState().installed, false);
  assert.equal(app.getInstallState().prompt, null);
});

test("switching to standalone refreshes subscribers and clears browser prompts", async () => {
  const { app, media, fakeWindow } = await browser();
  const prompt = Object.assign(
    new Event("beforeinstallprompt", { cancelable: true }),
    {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted" }),
    },
  );
  fakeWindow.dispatchEvent(prompt);
  assert.equal(app.getInstallState().prompt, prompt);
  let updates = 0;
  const unsubscribe = app.subscribeInstallState(() => updates++);
  media.matches = true;
  media.dispatchEvent(new Event("change"));
  assert.equal(app.getInstallState().installed, true);
  assert.equal(app.getInstallState().prompt, null);
  assert.equal(updates, 1);
  fakeWindow.dispatchEvent(new Event("pageshow"));
  assert.equal(updates, 1);
  unsubscribe();
});
