# Kyro 1.1.1 for Windows

Download **Kyro-Setup-1.1.1-x64.exe** and install over your previous version.
Windows 10 or 11 (64-bit) is required. Your existing account profile is retained.
Version 1.1.0 also receives this release through its automatic updater.

## 1.1.1

- Update availability automatically opens a prompt with the version, changes and
  installer size. Download now or defer until later.
- Downloaded updates offer a restart prompt with the same details. Active calls
  end only when you choose to restart or quit the app.
- Premium badge labels remain visible beside gradient display names.
- Founder controls support removing Premium and assigning any badge tier,
  including on the founder's own account. Premium tiers use their new names.
- Gift badges show an icon, with the number of gifts on hover or keyboard focus.
  Different icons appear at 1, 10, 25 and 50 gifts.

## 1.1.0

Download **Kyro-Setup-1.1.0-x64.exe** and install over your previous version.
Windows 10 or 11 (64-bit) is required. Your existing account profile is retained.
If you use 1.0.0, this one-time manual upgrade enables future automatic updates.

- **Connection fixed:** the app accepts both official Kyro HTTPS domains and
  opens `www.kyro-chat.cyou`, fixing the connection screen caused by redirects.
  Temporary failures reconnect automatically; certificate checks remain enforced.
- **Close to tray:** closing the window keeps calls and notifications running.
  Click the Kyro tray icon to reopen, or choose **Quit Kyro** to exit.
- **Automatic website updates:** the app checks for deployed web updates every
  five minutes and refreshes when idle. Calls, recordings, uploads, open dialogs,
  playback and unsent drafts delay the refresh until it is safe.
- **Automatic desktop updates:** future stable releases download in the background
  and install when you quit. **Kyro > Restart to update** installs a downloaded
  update immediately after confirmation.
- **Public source and downloads:** installers, update metadata, checksums and
  source code are available in this GitHub project.

The installer is unsigned; Windows may show an unknown publisher. Verify with:

```powershell
Get-FileHash .\Kyro-Setup-1.1.0-x64.exe -Algorithm SHA256
```

Compare the result with `SHA256SUMS.txt`. The blockmap and `latest.yml` assets are
for automatic updates; normal installation only needs the `.exe` file.
