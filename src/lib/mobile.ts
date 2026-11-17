export const ANDROID_VERSION = "1.0.0";
export const ANDROID_DOWNLOAD_URL =
  "https://github.com/adrianeosyne/KyroFree/releases/download/android-v1.0.0/Kyro-Android-1.0.0.apk";
export const ANDROID_SOURCE_URL =
  "https://github.com/adrianeosyne/KyroFree/tree/main/mobile/android";

export const IOS_VERSION = "1.0.0";
export const IOS_INSTALL_URL = "/install/ios";
export const IOS_DOWNLOAD_URL =
  "https://github.com/adrianeosyne/KyroFree/releases/download/ios-v1.0.0/Kyro-iOS-1.0.0-source.zip";
export const IOS_SOURCE_URL =
  "https://github.com/adrianeosyne/KyroFree/tree/main/mobile/ios";
export const IOS_BUILD_GUIDE_URL = `${IOS_SOURCE_URL}#build-and-test`;

export function mobilePlatform(): "android" | "ios" | null {
  if (typeof navigator === "undefined") return null;
  if (isIOSApp()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  if (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
    return "ios";
  return null;
}

export function isAndroidApp(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /KyroAndroid\//.test(navigator.userAgent)
  );
}

export function isIOSApp(): boolean {
  return (
    typeof navigator !== "undefined" && /KyroIOS\//.test(navigator.userAgent)
  );
}

export function isNativeMobileApp(): boolean {
  return isAndroidApp() || isIOSApp();
}
