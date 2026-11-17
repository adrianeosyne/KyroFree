import UIKit
import WebKit
import SafariServices

/// Native iPhone/iPad conveniences around the shared Kyro application.
final class KyroViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let initialURL: URL
    private var lastPage: URL
    private var webView: WKWebView!
    private let progress = UIProgressView(progressViewStyle: .bar)
    private let loading = UIActivityIndicatorView(style: .large)
    private let errorView = UIView()
    private let errorLabel = UILabel()
    private let toolbar = UIToolbar()
    private let downloads = DownloadStore()
    private var observations: [NSKeyValueObservation] = []
    private var processFailures: [Date] = []
    private var pendingDownload: URL?
    private lazy var backButton = makeItem("Back", symbol: "chevron.backward", id: "kyro.back", action: #selector(goBack))
    private lazy var forwardButton = makeItem("Forward", symbol: "chevron.forward", id: "kyro.forward", action: #selector(goForward))
    private lazy var reloadButton = makeItem("Reload", symbol: "arrow.clockwise", id: "kyro.reload", action: #selector(retry))
    private lazy var shareButton = makeItem("Share page", symbol: "square.and.arrow.up", id: "kyro.share", action: #selector(sharePage))
    private lazy var safariButton = makeItem("Open in Safari", symbol: "safari", id: "kyro.openSafari", action: #selector(openSafari))
    private lazy var filesButton = makeItem("Downloads", symbol: "arrow.down.to.line", id: "kyro.downloads", action: #selector(showDownloads))

    #if DEBUG
    private var usesTestFixture: Bool {
        ProcessInfo.processInfo.arguments.contains("--ui-testing") ||
        ProcessInfo.processInfo.arguments.contains("--ui-testing-offline")
    }
    #endif

    init(initialURL: URL) {
        self.initialURL = initialURL
        self.lastPage = initialURL
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init(initialURL:)") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureWebView()
        configureToolbar()
        configureErrorView()
        configureLayout()
        downloads.onFinish = { [weak self] file in
            self?.pendingDownload = file
            self?.offerCompletedDownload()
        }
        downloads.onError = { [weak self] message in self?.showMessage("Download stopped", message: message) }
        NotificationCenter.default.addObserver(self, selector: #selector(resumed),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-offline") {
            showError("Check your connection and try Kyro again.")
            return
        }
        #endif
        loadPage(initialURL)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        observations.forEach { $0.invalidate() }
    }

    private func configureWebView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = [.audio, .video]
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
        configuration.applicationNameForUserAgent = "KyroIOS/\(version)"
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.accessibilityIdentifier = "kyro.webView"
        if #available(iOS 16.4, *) {
            #if DEBUG
            webView.isInspectable = true
            #else
            webView.isInspectable = false
            #endif
        }
        observations.append(webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            self?.progress.progress = Float(webView.estimatedProgress)
        })
        observations.append(webView.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            self?.progress.isHidden = !webView.isLoading
            if webView.isLoading && self?.errorView.isHidden == true {
                self?.loading.startAnimating()
            } else {
                self?.loading.stopAnimating()
            }
        })
        observations.append(webView.observe(\.canGoBack, options: [.initial, .new]) { [weak self] webView, _ in
            self?.backButton.isEnabled = webView.canGoBack
        })
        observations.append(webView.observe(\.canGoForward, options: [.initial, .new]) { [weak self] webView, _ in
            self?.forwardButton.isEnabled = webView.canGoForward
        })
        loading.hidesWhenStopped = true
        loading.accessibilityIdentifier = "kyro.loading"
        loading.accessibilityLabel = "Loading Kyro"
        loading.color = .systemPurple
        progress.progressTintColor = .systemPurple
    }

    private func makeItem(_ title: String, symbol: String, id: String, action: Selector) -> UIBarButtonItem {
        let item = UIBarButtonItem(image: UIImage(systemName: symbol), style: .plain, target: self, action: action)
        item.accessibilityIdentifier = id
        item.accessibilityLabel = title
        return item
    }

    private func configureToolbar() {
        toolbar.tintColor = .systemPurple
        let space = { UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil) }
        toolbar.setItems([backButton, space(), forwardButton, space(), reloadButton,
                          space(), shareButton, space(), safariButton, space(), filesButton], animated: false)
        toolbar.accessibilityIdentifier = "kyro.toolbar"
    }

    private func configureErrorView() {
        errorView.backgroundColor = .systemBackground
        errorView.isHidden = true
        let icon = UIImageView(image: UIImage(systemName: "network.slash"))
        icon.contentMode = .scaleAspectFit
        icon.tintColor = .systemPurple
        icon.isAccessibilityElement = false
        let title = UILabel()
        title.text = "Let's get you reconnected"
        title.font = .preferredFont(forTextStyle: .title1)
        title.adjustsFontForContentSizeCategory = true
        title.numberOfLines = 0
        title.textAlignment = .center
        title.accessibilityTraits = .header
        errorLabel.font = .preferredFont(forTextStyle: .body)
        errorLabel.adjustsFontForContentSizeCategory = true
        errorLabel.textColor = .secondaryLabel
        errorLabel.numberOfLines = 0
        errorLabel.textAlignment = .center
        errorLabel.accessibilityIdentifier = "kyro.error"
        let retryButton = UIButton(type: .system)
        retryButton.configuration = .filled()
        retryButton.configuration?.title = "Try again"
        retryButton.configuration?.baseBackgroundColor = .systemPurple
        retryButton.configuration?.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 28, bottom: 14, trailing: 28)
        retryButton.accessibilityIdentifier = "kyro.retry"
        retryButton.addTarget(self, action: #selector(retry), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [icon, title, errorLabel, retryButton])
        stack.axis = .vertical
        stack.spacing = 20
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        errorView.addSubview(stack)
        NSLayoutConstraint.activate([
            icon.heightAnchor.constraint(equalToConstant: 48),
            icon.widthAnchor.constraint(equalToConstant: 48),
            stack.centerXAnchor.constraint(equalTo: errorView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: errorView.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: errorView.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: errorView.trailingAnchor, constant: -24),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
            title.widthAnchor.constraint(equalTo: stack.widthAnchor),
            errorLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
    }

    private func configureLayout() {
        [webView!, toolbar, progress, loading, errorView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        let safe = view.safeAreaLayoutGuide
        let keyboard = view.keyboardLayoutGuide
        NSLayoutConstraint.activate([
            toolbar.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            toolbar.bottomAnchor.constraint(equalTo: keyboard.topAnchor),
            toolbar.heightAnchor.constraint(equalToConstant: 44),
            webView.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            webView.topAnchor.constraint(equalTo: safe.topAnchor),
            webView.bottomAnchor.constraint(equalTo: toolbar.topAnchor),
            progress.topAnchor.constraint(equalTo: webView.topAnchor),
            progress.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
            loading.centerXAnchor.constraint(equalTo: webView.centerXAnchor),
            loading.centerYAnchor.constraint(equalTo: webView.centerYAnchor),
            errorView.topAnchor.constraint(equalTo: webView.topAnchor),
            errorView.bottomAnchor.constraint(equalTo: webView.bottomAnchor),
            errorView.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
        ])
    }

    func openKyro(_ url: URL) {
        guard NavigationPolicy.isKyro(url) else { return }
        loadViewIfNeeded()
        if presentedViewController != nil {
            dismiss(animated: true) { [weak self] in self?.loadPage(url) }
        } else {
            loadPage(url)
        }
    }

    private func loadPage(_ url: URL) {
        guard NavigationPolicy.isKyro(url) else { return }
        lastPage = url
        errorView.isHidden = true
        webView.isHidden = false
        #if DEBUG
        if usesTestFixture {
            webView.loadHTMLString(Self.testHTML, baseURL: NavigationPolicy.home)
            return
        }
        #endif
        webView.load(URLRequest(url: url))
    }

    @objc private func retry() {
        processFailures.removeAll()
        loadPage(lastPage)
    }

    @objc private func goBack() { if webView.canGoBack { webView.goBack() } }
    @objc private func goForward() { if webView.canGoForward { webView.goForward() } }

    @objc private func sharePage() {
        let url = NavigationPolicy.isKyro(webView.url) ? webView.url! : lastPage
        showShare(items: [url], anchor: shareButton)
    }

    @objc private func openSafari() {
        let url = NavigationPolicy.isKyro(webView.url) ? webView.url! : lastPage
        UIApplication.shared.open(url, options: [:]) { [weak self] opened in
            if !opened { self?.showMessage("Could not open Safari", message: "Try sharing this page with your browser.") }
        }
    }

    @objc private func showDownloads() {
        let available = downloads.completed.filter { FileManager.default.fileExists(atPath: $0.path) }
        guard !available.isEmpty else {
            showMessage("Your downloads", message: "Downloaded files appear here while Kyro is open. Use Share to save them to Files or another app.")
            return
        }
        let sheet = UIAlertController(title: "Your downloads", message: "Choose a file to save or share.", preferredStyle: .actionSheet)
        for file in available.reversed().prefix(10) {
            sheet.addAction(UIAlertAction(title: file.lastPathComponent, style: .default) { [weak self] _ in
                self?.showShare(items: [file], anchor: self?.filesButton)
            })
        }
        sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        sheet.popoverPresentationController?.barButtonItem = filesButton
        guard presentedViewController == nil else { return }
        present(sheet, animated: true)
    }

    private func showShare(items: [Any], anchor: UIBarButtonItem?) {
        guard presentedViewController == nil else {
            showMessage("Share this file", message: "Close the open dialog, then choose the file from Downloads.")
            return
        }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        sheet.popoverPresentationController?.barButtonItem = anchor ?? filesButton
        sheet.completionWithItemsHandler = { [weak self] _, _, _, _ in self?.offerCompletedDownload() }
        present(sheet, animated: true)
    }

    private func offerCompletedDownload() {
        guard UIApplication.shared.applicationState == .active,
              presentedViewController == nil, let file = pendingDownload else { return }
        pendingDownload = nil
        let alert = UIAlertController(title: "Download ready", message: file.lastPathComponent, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Save or share", style: .default) { [weak self] _ in
            self?.showShare(items: [file], anchor: self?.filesButton)
        })
        alert.addAction(UIAlertAction(title: "Later", style: .cancel))
        present(alert, animated: true)
    }

    @objc private func resumed() { offerCompletedDownload() }

    private func showMessage(_ title: String, message: String) {
        guard UIApplication.shared.applicationState == .active, presentedViewController == nil else { return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private func showError(_ message: String) {
        loading.stopAnimating()
        progress.isHidden = true
        webView.isHidden = true
        errorLabel.text = message
        errorView.isHidden = false
        backButton.isEnabled = webView.canGoBack
        forwardButton.isEnabled = webView.canGoForward
        UIAccessibility.post(notification: .screenChanged, argument: errorLabel)
    }

    private func openExternal(_ url: URL) {
        guard NavigationPolicy.canOpenExternally(url), UIApplication.shared.applicationState == .active else { return }
        if ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            guard presentedViewController == nil else { return }
            let safari = SFSafariViewController(url: url)
            safari.preferredControlTintColor = .systemPurple
            present(safari, animated: true)
        } else {
            UIApplication.shared.open(url, options: [:]) { [weak self] opened in
                if !opened { self?.showMessage("Could not open this link", message: "No app is available to open this link.") }
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let topLevel = navigationAction.targetFrame?.isMainFrame ?? true
        let trustedSource = NavigationPolicy.isKyro(webView.url) ||
            NavigationPolicy.isKyro(navigationAction.sourceFrame.request.url)
        #if DEBUG
        // Substitute-data HTML can have an opaque security origin. Exercise
        // the platform download handoff in tests independently of origin-policy
        // unit tests; this branch is completely absent from release builds.
        if usesTestFixture && navigationAction.shouldPerformDownload && url.scheme?.lowercased() == "blob" {
            decisionHandler(.download)
            return
        }
        #endif
        if navigationAction.shouldPerformDownload && navigationAction.sourceFrame.isMainFrame &&
            NavigationPolicy.isKyro(navigationAction.sourceFrame.request.url) &&
            NavigationPolicy.isKyro(webView.url) && NavigationPolicy.isDownloadURL(url) {
            decisionHandler(.download)
            return
        }
        if !topLevel {
            // Embedded HTTPS content has no native privileges. Media permissions
            // below remain limited to the trusted Kyro main frame.
            decisionHandler(NavigationPolicy.isHTTPSDownload(url) || url.absoluteString == "about:blank" ? .allow : .cancel)
            return
        }
        #if DEBUG
        if usesTestFixture && url.absoluteString == "about:blank" {
            decisionHandler(.allow)
            return
        }
        #endif
        if NavigationPolicy.isKyro(url) {
            if navigationAction.targetFrame == nil {
                decisionHandler(.cancel)
                loadPage(url)
            } else {
                decisionHandler(.allow)
            }
            return
        }
        decisionHandler(.cancel)
        if trustedSource && (navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil) {
            openExternal(url)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard navigationResponse.isForMainFrame else { decisionHandler(.allow); return }
        if let response = navigationResponse.response as? HTTPURLResponse, response.statusCode >= 400 {
            decisionHandler(.cancel)
            showError("Kyro is temporarily unavailable. Please try again in a moment.")
            return
        }
        let attachment = (navigationResponse.response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Disposition")?
            .lowercased().hasPrefix("attachment") == true
        if !navigationResponse.canShowMIMEType || attachment {
            decisionHandler(.download)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        downloads.receive(download)
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        downloads.receive(download)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        if let url = webView.url, NavigationPolicy.isKyro(url) { lastPage = url }
        errorView.isHidden = true
        webView.isHidden = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loading.stopAnimating()
        progress.isHidden = true
        if let url = webView.url, NavigationPolicy.isKyro(url) { lastPage = url }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleNavigationError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleNavigationError(error)
    }

    private func handleNavigationError(_ error: Error) {
        let failure = error as NSError
        // Policy cancellations and successful navigation-to-download handoffs
        // are not a lost connection and should not obscure the current page.
        guard !(failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled),
              !(failure.domain == "WebKitErrorDomain" && failure.code == 102)
        else { return }
        showError("Check your connection and try Kyro again.")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        let now = Date()
        processFailures = processFailures.filter { now.timeIntervalSince($0) < 60 }
        processFailures.append(now)
        if processFailures.count <= 2 {
            loadPage(lastPage)
        } else {
            showError("Kyro needs to reload. Tap Try again to reconnect.")
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // New windows are routed by decidePolicyFor; no second unrestricted
        // browser view can inherit this app's persistent session.
        return nil
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let trustedOrigin = origin.protocol.lowercased() == "https" &&
            ["kyro-chat.cyou", "www.kyro-chat.cyou"].contains(origin.host.lowercased()) &&
            (origin.port == 0 || origin.port == 443)
        let knownCapture = type == .camera || type == .microphone || type == .cameraAndMicrophone
        decisionHandler(trustedOrigin && frame.isMainFrame && NavigationPolicy.isKyro(frame.request.url) &&
                        NavigationPolicy.isKyro(webView.url) && knownCapture &&
                        UIApplication.shared.applicationState == .active ? .prompt : .deny)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard NavigationPolicy.isKyro(frame.request.url), presentedViewController == nil else {
            completionHandler(); return
        }
        let alert = UIAlertController(title: "Kyro", message: String(message.prefix(2000)), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard NavigationPolicy.isKyro(frame.request.url), presentedViewController == nil else {
            completionHandler(false); return
        }
        let alert = UIAlertController(title: "Kyro", message: String(message.prefix(2000)), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    #if DEBUG
    private static let testHTML = """
    <!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font:20px system-ui;padding:24px;color:#17171f;background:#f5f6f9}h1{color:#6b4fe0}</style>
    </head><body><h1>Kyro test page</h1><p>The native app is ready.</p>
    <label for="message">Message</label><input id="message" placeholder="Write a message">
    <p><button id="download" onclick="downloadFile()">Download test file</button></p>
    <script>
    function downloadFile() {
      const url = URL.createObjectURL(new Blob(['Kyro download test'], {type: 'text/plain'}));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'Kyro-test.txt';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    </script>
    </body></html>
    """
    #endif
}
