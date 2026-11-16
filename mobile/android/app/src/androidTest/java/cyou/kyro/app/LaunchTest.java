package cyou.kyro.app;

import android.webkit.WebView;
import android.view.ViewGroup;
import androidx.test.rule.ActivityTestRule;
import org.junit.Rule;
import org.junit.Test;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

public class LaunchTest {
    @Rule public ActivityTestRule<MainActivity> activity = new ActivityTestRule<>(MainActivity.class);

    @Test public void opensKyroWithPersistentStorageAndRestrictedWebSettings() throws Throwable {
        activity.runOnUiThread(() -> {
            ViewGroup root = activity.getActivity().findViewById(android.R.id.content);
            WebView web = (WebView) ((ViewGroup) root.getChildAt(0)).getChildAt(0);
            assertTrue(NavigationPolicy.isKyro(web.getUrl()));
            assertTrue(web.getSettings().getJavaScriptEnabled());
            assertTrue(web.getSettings().getDomStorageEnabled());
            assertFalse(web.getSettings().getAllowFileAccess());
            assertFalse(web.getSettings().getAllowContentAccess());
            assertTrue(web.getSettings().getUserAgentString().contains("KyroAndroid/"));
        });
    }

    @Test public void backClosesAnOpenDialogBeforeLeavingTheApp() throws Throwable {
        CountDownLatch loaded = new CountDownLatch(1);
        activity.runOnUiThread(() -> {
            WebView web = webView();
            web.setWebViewClient(new android.webkit.WebViewClient() {
                @Override public void onPageFinished(WebView view, String url) { loaded.countDown(); }
            });
            web.loadDataWithBaseURL(NavigationPolicy.HOME,
                "<html><body><div role='dialog'>Open dialog</div><script>"
                    + "document.addEventListener('keydown', event => { if (event.key === 'Escape') {"
                    + "event.preventDefault(); document.querySelector('[role=dialog]').remove(); } });"
                    + "</script></body></html>", "text/html", "UTF-8", null);
        });
        assertTrue("Dialog page loads", loaded.await(10, TimeUnit.SECONDS));
        assertEquals("true", evaluate("Boolean(document.querySelector('[role=dialog]'))"));
        activity.runOnUiThread(() -> activity.getActivity().onBackPressed());
        assertEquals("false", evaluate("Boolean(document.querySelector('[role=dialog]'))"));
        activity.runOnUiThread(() -> assertFalse(activity.getActivity().isFinishing()));
    }

    private WebView webView() {
        ViewGroup root = activity.getActivity().findViewById(android.R.id.content);
        return (WebView) ((ViewGroup) root.getChildAt(0)).getChildAt(0);
    }

    private String evaluate(String script) throws Throwable {
        CountDownLatch evaluated = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        activity.runOnUiThread(() -> webView().evaluateJavascript(script, value -> {
            result.set(value);
            evaluated.countDown();
        }));
        assertTrue("JavaScript evaluation completes", evaluated.await(10, TimeUnit.SECONDS));
        return result.get();
    }
}
