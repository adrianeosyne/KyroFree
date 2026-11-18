package cyou.kyro.app;

import java.net.URI;
import java.net.URISyntaxException;

/** Only the public Kyro HTTPS origins can run inside the privileged app view. */
public final class NavigationPolicy {
    public static final String HOME = "https://kyro-chat.cyou/dashboard";

    private NavigationPolicy() {}

    public static boolean isKyro(String url) {
        if (url == null) return false;
        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            return "https".equalsIgnoreCase(uri.getScheme())
                && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && ("kyro-chat.cyou".equalsIgnoreCase(host) || "www.kyro-chat.cyou".equalsIgnoreCase(host));
        } catch (URISyntaxException error) {
            return false;
        }
    }

    public static boolean canOpenExternally(String url) {
        if (url == null) return false;
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            if ("mailto".equalsIgnoreCase(scheme) || "tel".equalsIgnoreCase(scheme)) return true;
            return ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
                && uri.getHost() != null && uri.getRawUserInfo() == null;
        } catch (URISyntaxException error) {
            return false;
        }
    }
}
