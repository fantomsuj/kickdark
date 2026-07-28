chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== "number") return;

  chrome.tabs
    .sendMessage(tab.id, { type: "kick-night-mode:toggle" })
    .catch(() => {});
});
