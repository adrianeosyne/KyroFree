import UIKit

/// A single window with current UIKit lifecycle support on iPhone and iPad.
final class KyroSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var controller: KyroViewController?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let initialURL = connectionOptions.urlContexts
            .compactMap { NavigationPolicy.deepLinkURL($0.url) }
            .first ?? NavigationPolicy.home
        let controller = KyroViewController(initialURL: initialURL)
        self.controller = controller
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = controller
        self.window = window
        window.makeKeyAndVisible()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let destination = URLContexts.compactMap({ NavigationPolicy.deepLinkURL($0.url) }).first else { return }
        controller?.openKyro(destination)
    }
}
