import XCTest

final class LaunchTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunchShowsNativeWebViewAndAccessibleToolbar() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        XCTAssertTrue(app.webViews["kyro.webView"].waitForExistence(timeout: 15))
        for identifier in ["kyro.back", "kyro.forward", "kyro.reload", "kyro.share", "kyro.openSafari"] {
            XCTAssertTrue(app.buttons[identifier].exists, identifier)
        }
        XCTAssertTrue(app.webViews.staticTexts["Kyro test page"].waitForExistence(timeout: 10))
        app.buttons["kyro.reload"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Kyro test page"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["kyro.error"].exists)
        capture(app, name: "Kyro launch")
    }

    func testConnectionFailureOffersNativeRetry() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing", "--ui-testing-offline"]
        app.launch()
        XCTAssertTrue(app.buttons["kyro.retry"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["kyro.error"].exists)
        app.buttons["kyro.retry"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Kyro test page"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["kyro.retry"].exists)
        capture(app, name: "Kyro retry")
    }

    func testBlobDownloadIsSavedAndAvailableFromNativeDownloads() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        let button = app.webViews.buttons["Download test file"]
        XCTAssertTrue(button.waitForExistence(timeout: 15))
        button.tap()
        let ready = app.alerts["Download ready"]
        XCTAssertTrue(ready.waitForExistence(timeout: 20))
        XCTAssertTrue(ready.staticTexts["Kyro-test.txt"].exists)
        ready.buttons["Later"].tap()
        app.buttons["kyro.downloads"].tap()
        XCTAssertTrue(app.buttons["Kyro-test.txt"].waitForExistence(timeout: 10))
        capture(app, name: "Kyro native download")
    }

    func testIPadAndIPhoneRotationKeepsControlsAvailable() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        XCTAssertTrue(app.webViews.staticTexts["Kyro test page"].waitForExistence(timeout: 15))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.buttons["kyro.reload"].isHittable)
        XCUIDevice.shared.orientation = .portrait
        XCTAssertTrue(app.buttons["kyro.share"].isHittable)
    }

    func testTypingWithKeyboardKeepsNativeControlsAvailable() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        let field = app.webViews.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.tap()
        field.typeText("Hello from iOS")
        XCTAssertEqual(field.value as? String, "Hello from iOS")
        XCTAssertTrue(app.buttons["kyro.reload"].isHittable)
        XCTAssertTrue(app.buttons["kyro.share"].isHittable)
        capture(app, name: "Kyro keyboard layout")
        app.buttons["kyro.reload"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Kyro test page"].waitForExistence(timeout: 10))
    }

    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
