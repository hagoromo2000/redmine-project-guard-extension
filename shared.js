const REDMINE_PROJECT_GUARD = {
  contentScriptId: "redmine-project-guard-content-script",
  defaultRule: {
    enabled: true,
    matchType: "contains",
    pattern: "",
    bannerColor: "#be123c",
    textColor: "#ffffff",
    bannerPosition: "both",
    message: "警告対象のプロジェクトを開いています"
  },
  storageDefaults: {
    redmineHostPattern: "",
    rules: []
  },

  normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  },

  getHostPattern(input) {
    const value = this.normalizeText(input);
    if (!value) {
      return "";
    }

    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:") {
      throw new Error("HTTPS URLを入力してください");
    }

    return `${url.origin}/*`;
  }
};
