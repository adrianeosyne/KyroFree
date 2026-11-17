import Foundation

/// The same explicit public-origin boundary used by the Android client.
enum NavigationPolicy {
    static let home = URL(string: "https://kyro-chat.cyou/dashboard")!
    private static let hosts: Set<String> = ["kyro-chat.cyou", "www.kyro-chat.cyou"]

    static func isKyro(_ url: URL?) -> Bool {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "https",
              components.user == nil, components.password == nil,
              components.port == nil || components.port == 443,
              let host = components.host?.lowercased() else { return false }
        return hosts.contains(host)
    }

    static func canOpenExternally(_ url: URL?) -> Bool {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.user == nil, components.password == nil,
              let scheme = components.scheme?.lowercased() else { return false }
        switch scheme {
        case "https", "http":
            guard let host = components.host, !host.isEmpty else { return false }
            return components.port.map { (1...65535).contains($0) } ?? true
        case "mailto", "tel":
            return components.host == nil && !components.path.isEmpty
        default:
            return false
        }
    }

    /// Example: kyro://open?url=https%3A%2F%2Fkyro-chat.cyou%2Finvite%2Fcode
    static func deepLinkURL(_ url: URL) -> URL? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "kyro",
              components.host?.lowercased() == "open",
              components.user == nil, components.password == nil,
              components.port == nil, components.fragment == nil,
              components.path.isEmpty || components.path == "/",
              let items = components.queryItems, items.count == 1,
              items[0].name == "url", let value = items[0].value,
              let destination = URL(string: value), isKyro(destination) else { return nil }
        return destination
    }

    static func isHTTPSDownload(_ url: URL?) -> Bool {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "https",
              components.user == nil, components.password == nil,
              let host = components.host, !host.isEmpty else { return false }
        return components.port.map { (1...65535).contains($0) } ?? true
    }

    static func isDownloadURL(_ url: URL?) -> Bool {
        guard let url else { return false }
        if isHTTPSDownload(url) { return true }
        guard url.scheme?.lowercased() == "blob" else { return false }
        // Web-generated exports are blob:<origin>/<uuid>. Only Kyro's own
        // HTTPS origin may initiate those downloads; opaque blob:null is denied.
        return isKyro(URL(string: String(url.absoluteString.dropFirst(5))))
    }
}
