import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  isAndroidApp,
  isIOSApp,
  isNativeMobileApp,
  mobilePlatform,
} from "../../src/lib/mobile.ts";

const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);

function useNavigator(userAgent: string, platform = "", maxTouchPoints = 0) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent, platform, maxTouchPoints },
  });
}

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("iPhone Safari remains a browser with home-screen installation", () => {
  useNavigator(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
  );
  assert.equal(mobilePlatform(), "ios");
  assert.equal(isIOSApp(), false);
  assert.equal(isNativeMobileApp(), false);
});

test("the native iPhone app is recognized separately from Safari", () => {
  useNavigator(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) KyroIOS/1.0.0",
  );
  assert.equal(mobilePlatform(), "ios");
  assert.equal(isIOSApp(), true);
  assert.equal(isAndroidApp(), false);
  assert.equal(isNativeMobileApp(), true);
});

test("the native iPad app is recognized with a desktop user agent", () => {
  useNavigator(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) KyroIOS/1.0.0",
    "MacIntel",
  );
  assert.equal(mobilePlatform(), "ios");
  assert.equal(isNativeMobileApp(), true);
});

test("iPadOS Safari is detected from desktop platform and touch support", () => {
  useNavigator(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1",
    "MacIntel",
    5,
  );
  assert.equal(mobilePlatform(), "ios");
  assert.equal(isNativeMobileApp(), false);
});

test("desktop Safari remains a desktop browser", () => {
  useNavigator(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1",
    "MacIntel",
    0,
  );
  assert.equal(mobilePlatform(), null);
  assert.equal(isNativeMobileApp(), false);
});

test("Android browser and native app retain their existing behavior", () => {
  useNavigator("Mozilla/5.0 (Linux; Android 15; Pixel 7) Chrome/130");
  assert.equal(mobilePlatform(), "android");
  assert.equal(isNativeMobileApp(), false);
  useNavigator("Mozilla/5.0 (Linux; Android 15; Pixel 7) KyroAndroid/1.0.0");
  assert.equal(mobilePlatform(), "android");
  assert.equal(isAndroidApp(), true);
  assert.equal(isIOSApp(), false);
  assert.equal(isNativeMobileApp(), true);
});

test("server rendering works without a navigator", () => {
  Reflect.deleteProperty(globalThis, "navigator");
  assert.equal(mobilePlatform(), null);
  assert.equal(isAndroidApp(), false);
  assert.equal(isIOSApp(), false);
  assert.equal(isNativeMobileApp(), false);
});
