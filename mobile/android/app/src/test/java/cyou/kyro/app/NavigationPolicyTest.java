package cyou.kyro.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class NavigationPolicyTest {
    @Test public void acceptsOfficialHttpsPagesAndDeepLinks() {
        for (String url : new String[] { NavigationPolicy.HOME, "https://www.kyro-chat.cyou/gift/KYRO-ABCD", "https://kyro-chat.cyou:443/invite/hello?from=app" }) assertTrue(url, NavigationPolicy.isKyro(url));
    }
    @Test public void rejectsImpersonationAndLocalResources() {
        for (String url : new String[] { "http://kyro-chat.cyou", "https://kyro-chat.cyou.evil.example", "https://user@kyro-chat.cyou/", "https://kyro-chat.cyou:444/", "file:///etc/passwd", "javascript:alert(1)", "https://kyro-chat.cyou\\@evil.example", "intent://settings", "not a URL" }) assertFalse(url, NavigationPolicy.isKyro(url));
        assertFalse(NavigationPolicy.isKyro(null));
    }
    @Test public void externalLinksCannotLaunchArbitraryAndroidIntents() {
        assertTrue(NavigationPolicy.canOpenExternally("https://github.com/adrianeosyne/KyroFree"));
        assertTrue(NavigationPolicy.canOpenExternally("mailto:hello@example.com"));
        for (String url : new String[] { "intent://settings", "content://contacts", "file:///sdcard/private", "data:text/html,test", "javascript:alert(1)", "https://user:secret@example.com" }) assertFalse(url, NavigationPolicy.canOpenExternally(url));
    }
}
