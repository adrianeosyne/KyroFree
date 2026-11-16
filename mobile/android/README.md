# Kyro for Android

The native Android app for [Kyro](https://kyro-chat.cyou). Android 10 or newer.
It opens the same Kyro application whose complete React and Convex source is
in this repository. The Android source below adds platform navigation, safe
system insets, microphone/camera permission prompts, attachments, downloads,
deep links and a native connection retry screen. It does not inject a JavaScript
bridge, embed secrets, or ask for contacts or storage access.

## Download

[Install Kyro for Android 1.0.0](https://github.com/adrianeosyne/KyroFree/releases/download/android-v1.0.0/Kyro-Android-1.0.0.apk).
Open the APK and permit your browser to install this app when Android asks.
Updates must come from this repository and use the same signing certificate.
This release is distributed on GitHub; there is no Google Play listing yet.

## Source and building

Open `mobile/android` in Android Studio, or install JDK 17, Android SDK platform
35 and build tools 35.0.0, then run from this directory:

```sh
./gradlew testDebugUnitTest lintDebug assembleDebug
```

The debug APK is `app/build/outputs/apk/debug/app-debug.apk`. The project includes
the Gradle 8.11.1 wrapper and its distribution checksum. Native source is in
`app/src/main/java/cyou/kyro/app`. The app loads `https://kyro-chat.cyou/dashboard`
over HTTPS. The web UI and backend source are in the root `src/` directory.

For a release, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, then run:

```sh
./gradlew testDebugUnitTest lintRelease assembleRelease bundleRelease
```

The `.github/workflows/android-release.yml` workflow builds, verifies APK
signatures, runs a native launch test on an Android 15 emulator, and publishes
tagged `android-v1.0.0` downloads with SHA-256 checksums. Signing keys are kept
in GitHub Actions secrets; they must never be committed. Android App Links use
the public signing certificate in `public/.well-known/assetlinks.json`.

## Current mobile behavior

Use your existing Kyro account. Chats, communities, uploads, voice and video
use the current hosted Kyro services, so they need an internet connection.
Android Back follows page history before closing the app. Camera/microphone
access is requested only after starting a feature that needs it. External
links open in the appropriate Android app. The OS saves HTTPS downloads in
Downloads. Browser-generated files such as account exports can be saved from
the browser. Android WebView does not support browser screen sharing, and
calls are intended for foreground use; background calls and push notifications
are not included in this release.

No iOS app is included.
