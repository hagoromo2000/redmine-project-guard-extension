(function () {
  const DEFAULT_RULES = [];

  const STATE = {
    currentRuleId: null,
    currentSignature: null,
    observer: null,
    stopped: false
  };

  const STYLE_ID = "redmine-project-guard-style";
  const TOP_BANNER_ID = "redmine-project-guard-top-banner";
  const BOTTOM_BANNER_ID = "redmine-project-guard-bottom-banner";
  const BANNER_OWNER_ATTRIBUTE = "data-redmine-project-guard-banner";

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function getCurrentProjectName() {
    const currentProject = document.querySelector(".current-project");
    return normalizeText(currentProject && currentProject.textContent);
  }

  function wildcardToRegExp(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`, "i");
  }

  function matchesRule(projectName, rule) {
    if (!rule.enabled || !rule.pattern) {
      return false;
    }

    const pattern = normalizeText(rule.pattern);
    const target = normalizeText(projectName);

    if (rule.matchType === "exact") {
      return target === pattern;
    }

    if (rule.matchType === "wildcard") {
      return wildcardToRegExp(pattern).test(target);
    }

    return target.toLowerCase().includes(pattern.toLowerCase());
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .redmine-project-guard-banner {
        z-index: 2147483647;
        box-sizing: border-box;
        width: 100%;
        padding: 10px 16px;
        font: 700 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
        letter-spacing: 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      }

      #${TOP_BANNER_ID} {
        position: sticky;
        top: 0;
      }

      #${BOTTOM_BANNER_ID} {
        position: fixed;
        right: 0;
        bottom: 0;
        left: 0;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeHighlight() {
    STATE.currentRuleId = null;
    STATE.currentSignature = null;
    const body = document.body;
    if (body) {
      body.style.paddingBottom = "";
    }

    removeBanner(TOP_BANNER_ID);
    removeBanner(BOTTOM_BANNER_ID);
  }

  function removeBanner(id) {
    const banner = document.getElementById(id);
    if (banner) {
      banner.remove();
    }
  }

  function isExtensionContextInvalidated(error) {
    return error && String(error.message || error).includes("Extension context invalidated");
  }

  function stopContentScript() {
    STATE.stopped = true;
    if (STATE.observer) {
      STATE.observer.disconnect();
      STATE.observer = null;
    }
  }

  function shouldShowBanner(position, target) {
    const normalizedPosition = position || "both";
    return normalizedPosition === "both" || normalizedPosition === target;
  }

  function updateBanner(id, text, bannerColor, textColor, placeBanner) {
    if (!placeBanner) {
      removeBanner(id);
      return;
    }

    const body = document.body;
    if (!body) {
      return;
    }

    let banner = document.getElementById(id);
    const ownsBanner = banner && banner.getAttribute(BANNER_OWNER_ATTRIBUTE) === "true";
    if (banner && (!(banner instanceof HTMLDivElement) || !ownsBanner)) {
      banner.remove();
      banner = null;
    }

    if (!banner) {
      banner = document.createElement("div");
      banner.id = id;
      banner.setAttribute(BANNER_OWNER_ATTRIBUTE, "true");
    }

    try {
      banner.className = "redmine-project-guard-banner";

      if (id === TOP_BANNER_ID && banner.parentElement !== body) {
        body.insertBefore(banner, body.firstChild);
      }

      if (id === BOTTOM_BANNER_ID && banner.parentElement !== body) {
        body.appendChild(banner);
      }

      banner.style.backgroundColor = bannerColor;
      banner.style.color = textColor;
      banner.replaceChildren(document.createTextNode(text));
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        stopContentScript();
        return;
      }

      throw error;
    }
  }

  function applyHighlight(projectName, rule) {
    const bannerColor = rule.bannerColor || "#be123c";
    const textColor = rule.textColor || "#ffffff";
    const bannerPosition = rule.bannerPosition || "both";
    const message = rule.message || "警告対象のプロジェクトを開いています";
    const bannerText = `${message}（${projectName}）`;
    const signature = [
      rule.id,
      projectName,
      bannerColor,
      textColor,
      bannerPosition,
      message
    ].join("\n");

    if (STATE.currentSignature === signature) {
      return;
    }

    const body = document.body;
    if (!body) {
      return;
    }

    ensureStyle();
    updateBanner(
      TOP_BANNER_ID,
      bannerText,
      bannerColor,
      textColor,
      shouldShowBanner(bannerPosition, "top")
    );
    updateBanner(
      BOTTOM_BANNER_ID,
      bannerText,
      bannerColor,
      textColor,
      shouldShowBanner(bannerPosition, "bottom")
    );
    body.style.paddingBottom = shouldShowBanner(bannerPosition, "bottom") ? "44px" : "";
    STATE.currentRuleId = rule.id;
    STATE.currentSignature = signature;
  }

  function getRules() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ rules: DEFAULT_RULES }, (items) => {
          const error = chrome.runtime.lastError;
          if (error && isExtensionContextInvalidated(error)) {
            stopContentScript();
            resolve(DEFAULT_RULES);
            return;
          }

          resolve(Array.isArray(items.rules) ? items.rules : DEFAULT_RULES);
        });
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          stopContentScript();
          resolve(DEFAULT_RULES);
          return;
        }

        throw error;
      }
    });
  }

  async function evaluate() {
    if (STATE.stopped) {
      return;
    }

    const projectName = getCurrentProjectName();
    if (!projectName) {
      removeHighlight();
      return;
    }

    const rules = await getRules();
    const matchedRule = rules.find((rule) => matchesRule(projectName, rule));

    if (!matchedRule) {
      removeHighlight();
      return;
    }

    if (STATE.currentRuleId !== matchedRule.id) {
      applyHighlight(projectName, matchedRule);
      return;
    }

    applyHighlight(projectName, matchedRule);
  }

  function startObserver() {
    if (STATE.observer) {
      return;
    }

    STATE.observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        evaluate().catch((error) => {
          if (isExtensionContextInvalidated(error)) {
            stopContentScript();
            return;
          }

          throw error;
        });
      });
    });
    STATE.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (STATE.stopped) {
      return;
    }

    if (areaName === "sync" && changes.rules) {
      evaluate().catch((error) => {
        if (isExtensionContextInvalidated(error)) {
          stopContentScript();
          return;
        }

        throw error;
      });
    }
  });

  evaluate().catch((error) => {
    if (isExtensionContextInvalidated(error)) {
      stopContentScript();
      return;
    }

    throw error;
  });
  startObserver();
})();
