package cyou.kyro.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;

/** Android platform features for the shared, publicly available Kyro application. */
public class MainActivity extends Activity {
    private static final int FILE_PICKER = 20;
    private static final int MEDIA_PERMISSION = 21;
    private WebView webView;
    private ProgressBar progress;
    private LinearLayout offline;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest mediaRequest;
    private String lastPage = NavigationPolicy.HOME;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(23, 23, 31));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                return insets;
            });
        }
        webView = new WebView(this);
        webView.setId(View.generateViewId());
        webView.setBackgroundColor(Color.rgb(23, 23, 31));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(true);
        settings.setUserAgentString(settings.getUserAgentString() + " KyroAndroid/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        root.addView(progress, new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP));
        offline = createOfflineScreen();
        root.addView(offline, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (NavigationPolicy.isKyro(url)) return false;
                if (request.isForMainFrame()) openExternal(url);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                if (NavigationPolicy.isKyro(url)) lastPage = url;
                progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showOffline();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> requestMedia(request));
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (mediaRequest == request) mediaRequest = null;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_PICKER);
                } catch (ActivityNotFoundException error) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Install a file picker to attach files.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, android.os.Message result) {
                if (!userGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                        view.stopLoading();
                        if (NavigationPolicy.isKyro(url)) webView.loadUrl(url);
                        else openExternal(url);
                        view.destroy();
                    }
                });
                ((WebView.WebViewTransport) result.obj).setWebView(popup);
                result.sendToTarget();
                return true;
            }
        });
        webView.setDownloadListener((url, agent, disposition, mime, length) -> download(url, disposition, mime));
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
        if (state == null || webView.restoreState(state) == null) loadLaunchIntent(getIntent());
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private LinearLayout createOfflineScreen() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(28), dp(28), dp(28), dp(28));
        layout.setBackgroundColor(Color.rgb(23, 23, 31));
        TextView title = new TextView(this);
        title.setText("Let's get you reconnected");
        title.setTextColor(Color.WHITE);
        title.setTextSize(24);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);
        TextView hint = new TextView(this);
        hint.setText("Check your connection and try Kyro again.");
        hint.setTextColor(Color.rgb(170, 171, 190));
        hint.setPadding(0, dp(16), 0, dp(24));
        hint.setGravity(Gravity.CENTER);
        layout.addView(hint);
        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setOnClickListener(view -> { offline.setVisibility(View.GONE); webView.loadUrl(lastPage); });
        layout.addView(retry);
        layout.setVisibility(View.GONE);
        return layout;
    }

    private void showOffline() { progress.setVisibility(View.GONE); offline.setVisibility(View.VISIBLE); }

    private void openExternal(String url) {
        if (!NavigationPolicy.canOpenExternally(url)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No app is available to open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void download(String url, String disposition, String mime) {
        if (!url.startsWith("https://") || !NavigationPolicy.canOpenExternally(url)) {
            Toast.makeText(this, "Open Kyro in your browser to save this file.", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            String filename = URLUtil.guessFileName(url, disposition, mime).replaceAll("[\\\\/\\x00-\\x1F]", "_");
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle(filename);
            request.setMimeType(mime);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
            Toast.makeText(this, "Download started", Toast.LENGTH_SHORT).show();
        } catch (RuntimeException error) {
            Toast.makeText(this, "Could not download this file. Try opening it in your browser.", Toast.LENGTH_LONG).show();
        }
    }

    private void requestMedia(PermissionRequest request) {
        if (!NavigationPolicy.isKyro(request.getOrigin().toString()) || mediaRequest != null) {
            request.deny(); return;
        }
        ArrayList<String> permissions = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) permissions.add(Manifest.permission.RECORD_AUDIO);
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) permissions.add(Manifest.permission.CAMERA);
        }
        if (permissions.isEmpty()) { request.deny(); return; }
        mediaRequest = request;
        ArrayList<String> missing = new ArrayList<>();
        for (String permission : permissions) if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) missing.add(permission);
        if (missing.isEmpty()) grantMedia();
        else requestPermissions(missing.toArray(new String[0]), MEDIA_PERMISSION);
    }

    private void grantMedia() {
        PermissionRequest request = mediaRequest;
        mediaRequest = null;
        if (request == null) return;
        if (!NavigationPolicy.isKyro(webView.getUrl()) || !NavigationPolicy.isKyro(request.getOrigin().toString())) {
            request.deny(); return;
        }
        ArrayList<String> allowed = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) allowed.add(resource);
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) allowed.add(resource);
        }
        if (allowed.isEmpty()) request.deny(); else request.grant(allowed.toArray(new String[0]));
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == MEDIA_PERMISSION) grantMedia();
    }
    @Override protected void onActivityResult(int code, int result, Intent intent) {
        super.onActivityResult(code, result, intent);
        if (code == FILE_PICKER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, intent));
            fileCallback = null;
        }
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); loadLaunchIntent(intent); }
    private void loadLaunchIntent(Intent intent) {
        String url = intent == null ? null : intent.getDataString();
        webView.loadUrl(NavigationPolicy.isKyro(url) ? url : NavigationPolicy.HOME);
    }
    private void goBack() { if (webView.canGoBack()) webView.goBack(); else finish(); }
    @Override public void onBackPressed() { goBack(); }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); webView.saveState(state); }
    @Override protected void onDestroy() {
        if (mediaRequest != null) mediaRequest.deny();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.destroy();
        super.onDestroy();
    }
}
