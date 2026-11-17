# Kyro for iOS

Kyro for iPhone and iPad, iOS 16 or newer. This native Swift app opens
`https://kyro-chat.cyou/dashboard` in WebKit and uses your existing Kyro account.
The shared React interface and Convex backend live in the repository's `src/`
directory. The complete native Swift source and Xcode project are here.
Reuse is governed by the root [LICENSE](../../LICENSE), also included in the
release source ZIP.

Use a Mac, Xcode and a **free Apple ID Personal Team** to build and install it
on your own device. The project uses automatic development signing and has no
paid native dependencies. You do not need to provide a paid Team ID, distribution
certificate or App Store Connect key.

## Download

[Download the iOS source project](https://github.com/adrianeosyne/KyroFree/releases/download/ios-v1.0.0/Kyro-iOS-1.0.0-source.zip)
or [browse the complete source](https://github.com/adrianeosyne/KyroFree/tree/main/mobile/ios).

The ZIP contains the native iOS project. Clone the
[full repository](https://github.com/adrianeosyne/KyroFree/tree/main) for the
shared web interface, backend source and browser tests.

The GitHub release contains the native source ZIP with its license, a simulator
app, an unsigned device archive and SHA-256 checksums. The source ZIP must be
built and signed with your own free Personal Team in Xcode before it can run on
an iPhone. The unsigned archive is a build artifact, not an installation package.

For immediate browser access, open [Kyro](https://kyro-chat.cyou) in Safari and
choose **Share → Add to Home Screen**.

## Build and test

Use a Mac with Xcode and an installed iPhone simulator runtime. No npm install,
third-party native packages or Apple account is needed for the simulator build.

1. Download and extract the source ZIP, or clone this repository's `main` branch.
2. Open `mobile/ios/Kyro.xcodeproj` in Xcode and select the **Kyro** scheme.
3. Choose an installed iPhone or iPad simulator, then use **Product → Test** and
   **Product → Run**.

To test from the repository root, substitute the name of an installed simulator:

```sh
xcrun simctl list devices available
xcodebuild -project mobile/ios/Kyro.xcodeproj -scheme Kyro \
  -destination 'platform=iOS Simulator,name=<installed iPhone>' \
  test CODE_SIGNING_ALLOWED=NO
```

The [iOS build workflow](../../.github/workflows/ios-build.yml) selects an available
simulator, runs native unit and UI tests, then builds an unsigned device archive.
Tests cover navigation trust boundaries and the native launch and recovery
interface without a live account or network connection. Debug-only fixtures are
excluded from Release builds. Test results and build artifacts are retained.

Shared mobile detection tests require the full repository checkout and run from
its root with Node 24:

```sh
node --test tests/mobile/platform.test.ts
```

The focused `node scripts/ios-web-smoke.mjs` browser checks include Android
regression checks, iPhone Safari installation, iOS source/download links, narrow
layouts and native iOS installation-banner suppression. Browser tests use
isolated data fixtures. The broader `npm run test:ui` suite includes these checks.

## Install with your free Personal Team

1. Sign in with your free Apple ID in **Xcode → Settings → Accounts**.
2. Select the **Kyro** target and **Signing & Capabilities**. Keep **Automatically
   manage signing** enabled and choose your **Personal Team**.
3. If Xcode says `cyou.kyro.app` is unavailable, change the bundle identifier to a
   unique value such as `com.yourname.kyro`. Xcode creates the development
   provisioning profile automatically.
4. Connect your iPhone or iPad, trust the Mac, and enable **Settings → Privacy &
   Security → Developer Mode** when iOS requests it.
5. Select the connected device and use **Product → Run**. Xcode builds, signs and
   installs Kyro. If iOS asks you to trust the developer, use **Settings → General
   → VPN & Device Management**.

Free Personal Team development provisioning lasts about **seven days**. Connect
the device and run the app from Xcode again to renew it. Free provisioning also
has device and app limits imposed by Apple. A Personal Team supports development
on your own devices; it does not provide TestFlight or public App Store
distribution.

All signing happens locally through Xcode. Keep Apple account credentials,
certificates and provisioning profiles out of source control.

## Native behavior

The app adds native back/forward navigation, reload, link sharing, browser
handoff, authenticated WebKit downloads and a connection retry screen. WebKit
provides attachment pickers and prompts for camera/microphone access when needed.
Login storage persists across launches. Only Kyro's exact HTTPS origins can
navigate inside the app. No backend credentials or privileged JavaScript bridge
are embedded.

External web links open in an iOS browser view. **Open in Safari** hands the
current page to Safari, where you may need to sign in separately. **Downloads**
shows files from the current app session in a temporary cache. Use **Save to
Files** in the share sheet to keep a copy; previous-session cached files are
removed on the next app launch.

The custom URL format is
`kyro://open?url=https%3A%2F%2Fkyro-chat.cyou%2Finvite%2Fcode`.
Only a trusted Kyro HTTPS destination is accepted. Ordinary HTTPS invitations
open in the browser; universal links are not configured in this version.

## Physical-device checks and current limits

Simulator and browser checks verify specific behaviors. After installing the
development build, verify these features on your physical iPhone or iPad:

- Sign in, sign out, relaunch and account recovery, including persistent sessions.
- Chats, communities, attachment uploads and authenticated downloads saved to Files.
- Keyboard layout, rotation, safe areas, VoiceOver and larger text settings.
- Camera/microphone prompts, denied permissions, enabling access again in iOS
  Settings, and a foreground voice/video call with another device.
- External links, back/forward navigation, connection loss, retry and returning
  after backgrounding the app.

Calls are intended for foreground use. This version does not add push
notifications, CallKit or background calling, and WebKit does not provide browser
screen sharing here. Chat and uploaded content use the existing hosted Kyro
service and need an internet connection.
