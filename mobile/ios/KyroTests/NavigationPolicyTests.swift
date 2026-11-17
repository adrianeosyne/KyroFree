import XCTest
@testable import Kyro

final class NavigationPolicyTests: XCTestCase {
    func testOnlyTrustedHTTPSOriginsStayInApp() {
        for value in [
            "https://kyro-chat.cyou/dashboard",
            "https://www.kyro-chat.cyou/invite/test",
            "https://KYRO-CHAT.CYOU:443/auth?returnTo=%2Fdashboard",
        ] {
            XCTAssertTrue(NavigationPolicy.isKyro(URL(string: value)), value)
        }
        for value in [
            "http://kyro-chat.cyou/dashboard",
            "https://kyro-chat.cyou:444/dashboard",
            "https://kyro-chat.cyou.attacker.example/dashboard",
            "https://attacker.example/?host=kyro-chat.cyou",
            "https://user@kyro-chat.cyou/dashboard",
            "https://user:password@kyro-chat.cyou/dashboard",
            "file:///tmp/kyro-chat.cyou",
            "javascript:alert(1)",
            "data:text/html,Kyro",
        ] {
            XCTAssertFalse(NavigationPolicy.isKyro(URL(string: value)), value)
        }
        XCTAssertFalse(NavigationPolicy.isKyro(nil))
        XCTAssertTrue(NavigationPolicy.isKyro(NavigationPolicy.home))
    }

    func testExternalLinksHaveSafeSchemesAndNoCredentials() {
        for value in ["https://example.com/file", "http://example.com/", "mailto:hello@example.com", "tel:+94123456789"] {
            XCTAssertTrue(NavigationPolicy.canOpenExternally(URL(string: value)), value)
        }
        for value in ["javascript:alert(1)", "file:///tmp/file", "data:text/plain,secret", "https://user:password@example.com/", "kyro://open", "about:blank"] {
            XCTAssertFalse(NavigationPolicy.canOpenExternally(URL(string: value)), value)
        }
        XCTAssertFalse(NavigationPolicy.canOpenExternally(nil))
    }

    func testDeepLinksOnlyLoadAValidatedTrustedURL() {
        let destination = "https://kyro-chat.cyou/invite/test?source=ios"
        var link = URLComponents()
        link.scheme = "kyro"
        link.host = "open"
        link.queryItems = [URLQueryItem(name: "url", value: destination)]
        XCTAssertEqual(NavigationPolicy.deepLinkURL(link.url!), URL(string: destination))
        for value in [
            "kyro://open?url=https%3A%2F%2Fattacker.example",
            "kyro://open?url=http%3A%2F%2Fkyro-chat.cyou",
            "kyro://other?url=https%3A%2F%2Fkyro-chat.cyou",
            "https://open?url=https%3A%2F%2Fkyro-chat.cyou",
            "kyro://open",
            "kyro://open?url=https%3A%2F%2Fkyro-chat.cyou&url=https%3A%2F%2Fattacker.example",
        ] {
            XCTAssertNil(NavigationPolicy.deepLinkURL(URL(string: value)!), value)
        }
    }

    func testDownloadsRequireHTTPSAndRejectCredentials() {
        XCTAssertTrue(NavigationPolicy.isHTTPSDownload(URL(string: "https://files.example.com/media.png")))
        for value in ["http://files.example.com/file", "https://user:password@files.example.com/file", "file:///tmp/file", "data:text/plain,file", "blob:https://kyro-chat.cyou/file"] {
            XCTAssertFalse(NavigationPolicy.isHTTPSDownload(URL(string: value)), value)
        }
        XCTAssertFalse(NavigationPolicy.isHTTPSDownload(nil))
    }

    func testBlobDownloadsMustBelongToTheTrustedKyroOrigin() {
        for value in ["https://files.example.com/media.png", "blob:https://kyro-chat.cyou/download-id", "blob:https://www.kyro-chat.cyou/download-id"] {
            XCTAssertTrue(NavigationPolicy.isDownloadURL(URL(string: value)), value)
        }
        for value in ["blob:null/download-id", "blob:https://attacker.example/download-id", "blob:http://kyro-chat.cyou/download-id", "blob:https://user@kyro-chat.cyou/download-id", "http://files.example.com/file", "data:text/plain,file"] {
            XCTAssertFalse(NavigationPolicy.isDownloadURL(URL(string: value)), value)
        }
        XCTAssertFalse(NavigationPolicy.isDownloadURL(nil))
    }

    func testDownloadedFilenamesCannotTraverseDirectories() {
        for value in ["../../secret.txt", "folder\\secret.txt", "unsafe\u{0000}:name.txt"] {
            let filename = DownloadStore.safeFilename(value)
            XCTAssertFalse(filename.isEmpty)
            XCTAssertFalse(filename.contains("/"))
            XCTAssertFalse(filename.contains("\\"))
            XCTAssertFalse(filename.contains(":"))
            XCTAssertNil(filename.unicodeScalars.first(where: CharacterSet.controlCharacters.contains))
        }
        XCTAssertEqual(DownloadStore.safeFilename("..."), "Kyro-download")
        XCTAssertEqual(DownloadStore.safeFilename(""), "Kyro-download")
        XCTAssertEqual(DownloadStore.safeFilename("holiday.png"), "holiday.png")
        XCTAssertLessThanOrEqual(DownloadStore.safeFilename(String(repeating: "a", count: 500)).count, 120)
    }
}
