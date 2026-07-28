const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const backgroundPath = path.join(__dirname, "../src/background.js");

function loadBackground(sendMessage) {
  const backgroundSource = fs.existsSync(backgroundPath)
    ? fs.readFileSync(backgroundPath, "utf8")
    : "";
  let onClicked;

  vm.runInNewContext(backgroundSource, {
    chrome: {
      action: {
        onClicked: {
          addListener(listener) {
            onClicked = listener;
          }
        }
      },
      tabs: { sendMessage }
    }
  });

  return onClicked;
}

test("a toolbar click sends the toggle contract to its tab", async () => {
  const calls = [];
  const onClicked = loadBackground((tabId, message) => {
    calls.push({ tabId, message });
    return Promise.resolve();
  });

  onClicked({ id: 42 });
  await Promise.resolve();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].tabId, 42);
  assert.equal(calls[0].message.type, "kick-night-mode:toggle");
});

test("a click without a tab id has no effect", () => {
  let calls = 0;
  const onClicked = loadBackground(() => {
    calls += 1;
    return Promise.resolve();
  });

  onClicked({});

  assert.equal(calls, 0);
});

test("a missing content-script receiver is safely ignored", () => {
  let rejectionHandled = false;
  const onClicked = loadBackground(() => ({
    catch(handler) {
      rejectionHandled = true;
      handler(new Error("Receiving end does not exist"));
    }
  }));

  onClicked({ id: 42 });

  assert.equal(rejectionHandled, true);
});
