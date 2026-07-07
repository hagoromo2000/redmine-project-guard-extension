const DEFAULT_RULE = REDMINE_PROJECT_GUARD.defaultRule;

const redmineUrlElement = document.getElementById("redmine-url");
const rulesElement = document.getElementById("rules");
const ruleTemplate = document.getElementById("rule-template");
const addRuleButton = document.getElementById("add-rule");
const saveButton = document.getElementById("save");
const statusElement = document.getElementById("status");

function createId() {
  return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setRuleValues(ruleElement, rule) {
  ruleElement.dataset.id = rule.id || createId();
  ruleElement.querySelector(".rule-enabled").checked = Boolean(rule.enabled);
  ruleElement.querySelector(".rule-pattern").value = rule.pattern || "";
  ruleElement.querySelector(".rule-match-type").value = rule.matchType || "contains";
  ruleElement.querySelector(".rule-message").value = rule.message || "";
  ruleElement.querySelector(".rule-banner-position").value = rule.bannerPosition || "both";
  ruleElement.querySelector(".rule-banner-color").value = rule.bannerColor || "#be123c";
  ruleElement.querySelector(".rule-text-color").value = rule.textColor || "#ffffff";
}

function addRule(rule = DEFAULT_RULE) {
  const fragment = ruleTemplate.content.cloneNode(true);
  const ruleElement = fragment.querySelector(".rule");

  setRuleValues(ruleElement, {
    ...DEFAULT_RULE,
    ...rule,
    id: rule.id || createId()
  });

  ruleElement.querySelector(".remove-rule").addEventListener("click", () => {
    ruleElement.remove();
  });

  rulesElement.appendChild(ruleElement);
}

function readRule(ruleElement) {
  return {
    id: ruleElement.dataset.id || createId(),
    enabled: ruleElement.querySelector(".rule-enabled").checked,
    pattern: ruleElement.querySelector(".rule-pattern").value.trim(),
    matchType: ruleElement.querySelector(".rule-match-type").value,
    message: ruleElement.querySelector(".rule-message").value.trim(),
    bannerPosition: ruleElement.querySelector(".rule-banner-position").value,
    bannerColor: ruleElement.querySelector(".rule-banner-color").value,
    textColor: ruleElement.querySelector(".rule-text-color").value
  };
}

function getRules() {
  return Array.from(rulesElement.querySelectorAll(".rule"))
    .map(readRule)
    .filter((rule) => rule.pattern);
}

function loadRules() {
  chrome.storage.sync.get(REDMINE_PROJECT_GUARD.storageDefaults, (items) => {
    redmineUrlElement.value = items.redmineHostPattern
      ? items.redmineHostPattern.replace(/\/\*$/, "/")
      : "";
    rulesElement.innerHTML = "";

    if (Array.isArray(items.rules) && items.rules.length > 0) {
      items.rules.forEach(addRule);
      return;
    }

    addRule();
  });
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);

  if (!isError) {
    window.setTimeout(() => {
      statusElement.textContent = "";
    }, 1800);
  }
}

function requestHostPermission(redmineHostPattern) {
  return new Promise((resolve) => {
    chrome.permissions.request(
      {
        origins: [redmineHostPattern]
      },
      resolve
    );
  });
}

function removeHostPermission(redmineHostPattern) {
  return new Promise((resolve) => {
    chrome.permissions.remove(
      {
        origins: [redmineHostPattern]
      },
      resolve
    );
  });
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(REDMINE_PROJECT_GUARD.storageDefaults, resolve);
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

function sendRegisterMessage() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "register-content-script" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.ok) {
        reject(new Error((response && response.message) || "content scriptの登録に失敗しました"));
        return;
      }

      resolve();
    });
  });
}

async function saveRules() {
  try {
    const redmineHostPattern = REDMINE_PROJECT_GUARD.getHostPattern(redmineUrlElement.value);
    if (!redmineHostPattern) {
      setStatus("Redmine URLを入力してください", true);
      return;
    }

    const granted = await requestHostPermission(redmineHostPattern);
    if (!granted) {
      setStatus("Redmine URLへのアクセス許可が必要です", true);
      return;
    }

    const currentSettings = await getSettings();
    await saveSettings({
      redmineHostPattern,
      rules: getRules()
    });
    await sendRegisterMessage();

    if (
      currentSettings.redmineHostPattern &&
      currentSettings.redmineHostPattern !== redmineHostPattern
    ) {
      await removeHostPermission(currentSettings.redmineHostPattern);
    }

    setStatus("保存しました");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function migrateRules() {
  chrome.storage.sync.get(REDMINE_PROJECT_GUARD.storageDefaults, (items) => {
    if (Array.isArray(items.rules) && items.rules.length > 0) {
      return;
    }

    chrome.storage.sync.set({
      rules: []
    });
  });
}

addRuleButton.addEventListener("click", () => addRule());
saveButton.addEventListener("click", saveRules);

migrateRules();
loadRules();
