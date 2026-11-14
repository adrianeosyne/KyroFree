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
  };
}

test("release updates use the public feed, download automatically and wait for quit", async () => {
  const s = setup();
  s.updates.start();
  await new Promise(setImmediate);
  assert.equal(s.updater.feed.owner, "adrianeosyne");
  assert.equal(s.updater.feed.repo, "KyroFree");
  assert.equal(s.updater.autoDownload, true);
  assert.equal(s.updater.autoInstallOnAppQuit, true);
  assert.equal(s.updater.allowDowngrade, false);
  s.updater.emit("update-downloaded");
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
