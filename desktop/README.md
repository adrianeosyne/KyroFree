# Kyro for Windows

The desktop app opens the live [Kyro service](https://www.kyro-chat.cyou/dashboard)
in a sandboxed Electron window. Windows 10 or 11 (x64) and an internet connection
are required. Accounts and browser storage persist between upgrades.

- [Download the latest installer](https://github.com/adrianeosyne/KyroFree/releases/latest)
- [Browse the source](https://github.com/adrianeosyne/KyroFree/tree/main/desktop)

## Upgrade from 1.0.0

Install `Kyro-Setup-1.1.1-x64.exe` over the old app once. Version 1.0.0 has no
native updater and blocks the website's redirect from the apex domain to `www`,
causing its connection screen. Version 1.1.0 trusts both exact official HTTPS
origins and opens the canonical `www` address. No deployment-specific Vercel
hostname is embedded in the app. Temporary failures retry every 15 seconds;
certificate errors require manual retry and never bypass certificate validation.

## Tray and updates

Closing the main window hides it in the Windows system tray. Calls, notifications,
and the signed-in session keep running. Click the tray icon to reopen, or choose
**Quit Kyro** from its menu to exit completely. A second launch opens the existing
window. If Windows cannot create a tray icon, closing the window exits normally.
No automatic launch-at-login entry is installed.

The website checks for a new deployed build every five minutes (first check after
one minute). Updates refresh the desktop automatically after one minute without
interaction, once calls, drafts, uploads, recordings, media playback and dialogs
are clear. Drafts in other conversations also delay updates. Failed version checks
leave the running page alone. The regular browser experience is unchanged.

Native desktop updates are checked at launch and every four hours using the public
GitHub release feed. An automatic prompt shows the new version, release notes and
installer size, with **Download update** and **Later** choices. Accepted downloads
run in the background. Once downloaded, a second prompt offers to restart and
install, with the same release details. Choosing Later installs when the user
actually quits. Closing to the tray does not install or interrupt a call.
Use **Kyro > Check for updates** or **Restart to update** for manual control.
The remote website has no native IPC bridge and cannot choose the update feed.

## Develop and verify

Use Node.js 24 and npm on Windows:

```powershell
npm ci
npm --prefix desktop ci
npm run test:desktop
node scripts/desktop-update-smoke.mjs
npm run typecheck
npm run build
npm run build:desktop
node scripts/desktop-smoke.mjs
```

The desktop has a separate package and lockfile. Build output is under
`desktop/release/` and excluded from Git. Packaged smoke checks use hidden windows
and an isolated temporary profile; native update downloads are disabled there.
They cover live startup, redirects, profile persistence, close-to-tray, renderer
isolation, permissions, screen-picker cancellation, and connection recovery.
Browser update checks simulate new deployments, calls, uploads and drafts without
real accounts. These checks do not establish multi-user voice/video quality.

## Release

1. Bump the desktop package version and lockfile. Update the download-page version
   and these release notes. Run the checks above.
2. Build the NSIS installer, `*.exe.blockmap` and `latest.yml`. The latter contains
   the SHA-512 integrity value used by the updater. Keep these files together in
   the **same GitHub release**; never replace an installer for a published version.
3. Generate `SHA256SUMS.txt` using `Get-FileHash` and include it in the release.
4. Publish a stable `desktop-v<version>` release in `adrianeosyne/KyroFree` only
   after all assets are uploaded and checked. Pre-releases do not reach stable
   clients. GitHub's automatic source archive corresponds to the release tag.
5. Deploy the website changes separately. Every Vite build emits a fresh
   `desktop-version.json`; Vercel serves it with `Cache-Control: no-store`.

The Windows GitHub Actions workflow creates a **draft** release on `desktop-v*`
tags or manual dispatch. Review and publish the draft to deliver future native
updates. Local builds use `--publish never` and never upload artifacts themselves.

The current installer is unsigned and Windows may show an unknown publisher.
Configure electron-builder signing credentials in CI to sign future releases;
never commit them. Keep credentials, profiles and build outputs out of Git.

## Security

Only the exact `https://kyro-chat.cyou` and `https://www.kyro-chat.cyou` origins can
navigate the app. Other HTTP(S) and email links open the default browser; executable
and custom OS protocols are blocked. The renderer has a sandbox, context isolation,
normal web security, no Node integration and no preload bridge. Native microphone,
camera and notification consent is session-scoped. Screen sharing uses a separate
local picker and requires explicit source selection. Downloads never auto-execute.
