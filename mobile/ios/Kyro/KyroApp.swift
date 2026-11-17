import UIKit

@main
final class KyroApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var controller: KyroViewController?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let incomingURL = launchOptions?[.url] as? URL
        let initialURL = incomingURL.flatMap(NavigationPolicy.deepLinkURL) ?? NavigationPolicy.home
        let controller = KyroViewController(initialURL: initialURL)
        self.controller = controller
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        guard let destination = NavigationPolicy.deepLinkURL(url) else { return false }
        controller?.openKyro(destination)
        return true
    }
}
