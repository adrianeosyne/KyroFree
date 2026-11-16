const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const vm = require("node:vm");

function setup(enabled = true) {
  const updater = new EventEmitter();
  let checks = 0,
    installs = 0,
    notices = 0,
    beforeInstalls = 0;
  let response = 0;
  let downloads = 0;
  const messages = [];
  updater.setFeedURL = (feed) => {
    updater.feed = feed;
  };
  updater.checkForUpdates = async () => {
    checks++;
  };
  updater.quitAndInstall = () => {
    installs++;
  };
  updater.downloadUpdate = async () => {
    downloads++;
  };
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../dist/updates.js"), "utf8"),
    {
      exports: module.exports,
      require: (name) =>
        name === "electron-updater"
          ? { autoUpdater: updater }
          : {
              dialog: {
                showMessageBox: async (message) => {
                  messages.push(message);
                  return { response };
                },
              },
            },
      setInterval: () => ({ unref() {} }),
      clearInterval() {},
    },
  );
  const updates = new module.exports.DesktopUpdates({
    enabled,
    beforeInstall: () => {
      beforeInstalls++;
    },
    notify: () => {
      notices++;
    },
  });
  return {
    updates,
    updater,
    messages,
    answer: (value) => {
      response = value;
    },
    counts: () => ({ checks, installs, notices, beforeInstalls }),
    downloadCount: () => downloads,
  };
}

test("release updates use the public feed and confirm installation automatically after download", async () => {
  const s = setup();
  s.updates.start();
  await new Promise(setImmediate);
  assert.equal(s.updater.feed.owner, "adrianeosyne");
  assert.equal(s.updater.feed.repo, "KyroFree");
  assert.equal(s.updater.autoDownload, false);
  assert.equal(s.updater.autoInstallOnAppQuit, true);
  assert.equal(s.updater.allowDowngrade, false);
  s.updater.emit("update-downloaded");
  await new Promise(setImmediate);
  assert.match(s.messages.at(-1).message, /Restart Kyro/);
  assert.deepEqual(s.counts(), {
    checks: 1,
    installs: 0,
    notices: 1,
    beforeInstalls: 0,
  });
  await s.updates.install();
  assert.equal(s.counts().installs, 0);
  s.answer(1);
  await s.updates.install();
  assert.equal(s.counts().installs, 1);
  assert.equal(s.counts().beforeInstalls, 1);
});

const release = {
  version: "1.2.0",
  files: [{ url: "Kyro-Setup-1.2.0-x64.exe", size: 125 * 1024 * 1024 }],
  releaseNotes:
    "<h2>New features</h2><ul><li>Founder Premium controls</li><li>Gift badges &amp; tiers</li></ul>",
};

test("a background check automatically offers the version, changes and installer size once per release", async () => {
  const s = setup();
  s.updater.checkForUpdates = async () => {
    s.updater.emit("update-available", release);
  };
  s.updates.start();
  await new Promise(setImmediate);
  const offer = s.messages.at(-1);
  assert.match(offer.message, /1\.2\.0/);
  assert.match(offer.detail, /125\.0 MB/);
  assert.match(offer.detail, /Founder Premium controls/);
  assert.match(offer.detail, /Gift badges & tiers/);
  assert(!offer.detail.includes("<li>"));
  assert.equal(s.downloadCount(), 0);
  await s.updates.check();
  assert.equal(s.messages.length, 1);
  await s.updates.check(true);
  assert.equal(s.messages.length, 2);
});

test("accepted updates download, automatically ask to restart, and respect Later", async () => {
  const s = setup();
  s.answer(1);
  s.updater.checkForUpdates = async () => {
    s.updater.emit("update-available", release);
  };
  s.updates.start();
  await new Promise(setImmediate);
  assert.equal(s.downloadCount(), 1);
  assert.equal(s.counts().installs, 0);
  s.answer(0);
  s.updater.emit("update-downloaded", release);
  await new Promise(setImmediate);
  const ready = s.messages.at(-1);
  assert.match(ready.message, /install 1\.2\.0/);
  assert.match(ready.detail, /125\.0 MB/);
  assert.match(ready.detail, /Founder Premium controls/);
  assert.equal(s.counts().installs, 0);
  s.answer(1);
  await s.updates.install();
  assert.equal(s.counts().installs, 1);
});

test("a newer release prompts again and missing size or release notes are handled honestly", async () => {
  const s = setup();
  let info = release;
  s.updater.checkForUpdates = async () => {
    s.updater.emit("update-available", info);
  };
  s.updates.start();
  await new Promise(setImmediate);
  info = {
    version: "1.3.0",
    files: [],
    releaseNotes: [{ version: "1.3.0", note: "New voice features" }],
  };
  await s.updates.check();
  assert.equal(s.messages.length, 2);
  assert.match(s.messages.at(-1).detail, /New voice features/);
  assert.match(s.messages.at(-1).detail, /Not provided by this release/);
  info = { version: "1.4.0", files: [{ url: "app.exe", size: -1 }] };
  await s.updates.check();
  assert.match(s.messages.at(-1).detail, /Release notes were not included/);
});

test("interrupted accepted downloads report the failure and allow another automatic offer", async () => {
  const s = setup();
  s.answer(1);
  s.updater.checkForUpdates = async () => {
    s.updater.emit("update-available", release);
  };
  s.updater.downloadUpdate = async () => {
    throw new Error("offline");
  };
  s.updates.start();
  await new Promise(setImmediate);
  assert.match(s.messages.at(-1).message, /Couldn't download/);
  s.answer(0);
  await s.updates.check();
  assert.equal(s.messages.at(-1).title, "Kyro update available");
  assert.equal(s.counts().installs, 0);
});

test("network failures can retry and never install anything", async () => {
  const s = setup();
  s.updates.start();
  await new Promise(setImmediate);
  s.updater.checkForUpdates = async () => {
    throw new Error("offline");
  };
  await s.updates.check(true);
  assert.match(s.messages.at(-1).message, /Couldn't check/);
  s.updater.checkForUpdates = async () => {
    s.updater.emit("update-not-available");
  };
  await s.updates.check(true);
  assert.match(s.messages.at(-1).message, /up to date/);
  assert.equal(s.counts().installs, 0);
});

test("development and smoke builds do not contact the release service", async () => {
  const s = setup(false);
  s.updates.start();
  await s.updates.check(true);
  assert.equal(s.counts().checks, 0);
  assert.equal(s.counts().installs, 0);
});

test("a failed background download is handled independently of metadata checks", async () => {
  const s = setup();
  s.updater.checkForUpdates = async () => ({
    downloadPromise: Promise.reject(new Error("download interrupted")),
  });
  s.updates.start();
  await new Promise(setImmediate);
  assert.equal(s.counts().installs, 0);
  await s.updates.check();
});
