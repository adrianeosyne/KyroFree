package cyou.kyro.app;

import android.webkit.WebView;
import android.view.ViewGroup;
import androidx.test.rule.ActivityTestRule;
import org.junit.Rule;
import org.junit.Test;
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
}
