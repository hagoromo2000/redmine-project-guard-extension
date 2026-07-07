importScripts("shared.js");

async function getRegisteredScriptIds() {
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  return scripts.map((script) => script.id);
}

async function unregisterContentScriptIfNeeded() {
  const scriptIds = await getRegisteredScriptIds();
  if (scriptIds.includes(REDMINE_PROJECT_GUARD.contentScriptId)) {
    await chrome.scripting.unregisterContentScripts({
      ids: [REDMINE_PROJECT_GUARD.contentScriptId]
    });
  }
}

function hasHostPermission(redmineHostPattern) {
  return new Promise((resolve) => {
    chrome.permissions.contains(
      {
        origins: [redmineHostPattern]
      },
      resolve
    );
  });
}

async function registerConfiguredContentScript() {
  const { redmineHostPattern } = await chrome.storage.sync.get(
    REDMINE_PROJECT_GUARD.storageDefaults
  );

  await unregisterContentScriptIfNeeded();

  if (!redmineHostPattern) {
    return;
  }

  const granted = await hasHostPermission(redmineHostPattern);
  if (!granted) {
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: REDMINE_PROJECT_GUARD.contentScriptId,
      matches: [redmineHostPattern],
      js: ["content.js"],
      runAt: "document_idle"
    }
  ]);
}

chrome.runtime.onInstalled.addListener(() => {
  registerConfiguredContentScript().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  registerConfiguredContentScript().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "register-content-script") {
    return false;
  }

  registerConfiguredContentScript()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, message: error.message }));

  return true;
});
