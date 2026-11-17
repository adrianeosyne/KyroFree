import Foundation
import WebKit

/// WKDownload keeps the browser's authenticated request and cookies intact.
/// Files stay in the app's cache until the user chooses a share destination.
final class DownloadStore: NSObject, WKDownloadDelegate {
    private struct Pending {
        let download: WKDownload
        var destination: URL?
    }
    private var pending: [ObjectIdentifier: Pending] = [:]
    private(set) var completed: [URL] = []
    var onFinish: ((URL) -> Void)?
    var onError: ((String) -> Void)?
    private let directory: URL

    override init() {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("KyroDownloads", isDirectory: true)
        super.init()
        // Previous sessions are not a permanent download library. A share sheet
        // copies exported files; removing old cache files leaves those copies alone.
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let oldDirectories = try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: nil) {
            for url in oldDirectories {
                try? FileManager.default.removeItem(at: url)
            }
        }
    }

    func receive(_ download: WKDownload) {
        #if DEBUG
        print("Kyro WKDownload received")
        #endif
        pending[ObjectIdentifier(download)] = Pending(download: download)
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        #if DEBUG
        print("Kyro WKDownload destination requested")
        #endif
        let key = ObjectIdentifier(download)
        guard pending[key] != nil else { completionHandler(nil); return }
        let folder = directory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let filename = Self.safeFilename(suggestedFilename)
            let destination = folder.appendingPathComponent(filename, isDirectory: false)
            pending[key]?.destination = destination
            completionHandler(destination)
        } catch {
            pending.removeValue(forKey: key)
            completionHandler(nil)
            onError?("There isn't enough space to save this file. Free some space and try again.")
        }
    }

    func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest,
                  decisionHandler: @escaping (WKDownload.RedirectPolicy) -> Void) {
        decisionHandler(NavigationPolicy.isHTTPSDownload(request.url) ? .allow : .cancel)
    }

    func downloadDidFinish(_ download: WKDownload) {
        #if DEBUG
        print("Kyro WKDownload finished")
        #endif
        guard let file = pending.removeValue(forKey: ObjectIdentifier(download))?.destination else { return }
        guard FileManager.default.fileExists(atPath: file.path) else {
            onError?("The file could not be saved. Please try again.")
            return
        }
        completed.append(file)
        onFinish?(file)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        #if DEBUG
        let failure = error as NSError
        print("Kyro WKDownload failed domain=\(failure.domain) code=\(failure.code)")
        #endif
        if let file = pending.removeValue(forKey: ObjectIdentifier(download))?.destination {
            try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
        }
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        onError?("The download stopped. Check your connection and try downloading the file again.")
    }

    static func safeFilename(_ suggested: String) -> String {
        let disallowed = CharacterSet.controlCharacters.union(CharacterSet(charactersIn: "/\\:"))
        let cleaned = suggested.unicodeScalars.map { disallowed.contains($0) ? "_" : String($0) }.joined()
        let trimmed = cleaned.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: ".")))
        guard !trimmed.isEmpty else { return "Kyro-download" }
        let candidateExtension = (trimmed as NSString).pathExtension
        let suffix = !candidateExtension.isEmpty && candidateExtension.utf8.count <= 20 ? ".\(candidateExtension)" : ""
        let basename = suffix.isEmpty ? trimmed : String(trimmed.dropLast(suffix.count))
        var shortened = String(basename.prefix(120))
        while shortened.utf8.count + suffix.utf8.count > 200 { shortened.removeLast() }
        return (shortened.isEmpty ? "Kyro-download" : shortened) + suffix
    }
}
