# Kyro 1.1.0 for Windows

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
