import {
    readProfilesConfig,
    saveProfilesConfig,
    getActiveProfile,
    extractHostname,
    readRoutingRules,
    addRoutingRule,
    removeRoutingRule,
    matchRoutingRule
} from "../common/utils.js";
import { Aria2 } from "../common/aria2.js";

let config = { profiles: [], activeProfileId: "default" };
let currentTab = null;
let currentDomain = "";
let matchedRule = null;

const formatExpiry = (expiresAt) => {
    if (expiresAt === "session") return "This session";
    if (!expiresAt) return "Permanent";
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return "Expired";
    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m remaining`;
    const diffHours = Math.ceil(diffMs / 3600000);
    return `${diffHours}h remaining`;
};

const updateProfileView = () => {
    const profileSelect = document.getElementById("profile-select");
    const profileInfo = document.getElementById("profile-info");
    if (!profileSelect || !profileInfo) return;

    profileSelect.innerHTML = "";
    for (const p of config.profiles) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        profileSelect.appendChild(opt);
    }
    profileSelect.value = config.activeProfileId;

    const activeProfile = getActiveProfile(config.profiles, config.activeProfileId);
    if (activeProfile) {
        const proto = (activeProfile.protocol || "http").toUpperCase();
        const hostPort = `${proto}://${activeProfile.host}:${activeProfile.port}`;
        const dir = activeProfile.dir ? ` | ${activeProfile.dir}` : "";
        profileInfo.textContent = `${hostPort}${dir}`;
    } else {
        profileInfo.textContent = "";
    }
};

const testConnection = async () => {
    const badge = document.getElementById("conn-badge");
    if (!badge) return;

    badge.textContent = "Connecting...";
    badge.className = "badge badge-loading";

    const activeProfile = getActiveProfile(config.profiles, config.activeProfileId);
    if (!activeProfile) {
        badge.textContent = "No profile";
        badge.className = "badge badge-error";
        return;
    }

    const client = new Aria2(activeProfile);
    try {
        const ver = await client.call("getVersion");
        badge.textContent = `Online (v${ver.version})`;
        badge.className = "badge badge-success";
    } catch (e) {
        badge.textContent = "Offline";
        badge.className = "badge badge-error";
    } finally {
        try {
            client.close();
        } catch (_) {}
    }
};

const updateSiteRuleView = async () => {
    const siteDomainEl = document.getElementById("site-domain");
    const noSiteView = document.getElementById("no-site-view");
    const activeRuleView = document.getElementById("active-rule-view");
    const createRuleView = document.getElementById("create-rule-view");

    if (!siteDomainEl || !noSiteView || !activeRuleView || !createRuleView) return;

    if (!currentDomain) {
        siteDomainEl.textContent = "No site";
        noSiteView.style.display = "block";
        activeRuleView.style.display = "none";
        createRuleView.style.display = "none";
        return;
    }

    siteDomainEl.textContent = currentDomain;
    noSiteView.style.display = "none";

    const rules = await readRoutingRules();
    matchedRule = matchRoutingRule(rules, currentTab ? currentTab.url : "", currentTab ? currentTab.url : "");

    if (matchedRule) {
        createRuleView.style.display = "none";
        activeRuleView.style.display = "block";

        const badge = document.getElementById("active-action-badge");
        if (badge) {
            badge.textContent = matchedRule.action === "aria2" ? "Aria2" : "Firefox";
            badge.className = `badge ${matchedRule.action === "aria2" ? "badge-aria2" : "badge-firefox"}`;
        }

        const expiryEl = document.getElementById("active-expiry-text");
        if (expiryEl) {
            expiryEl.textContent = formatExpiry(matchedRule.expiresAt);
        }

        const patternEl = document.getElementById("active-pattern-text");
        if (patternEl) {
            patternEl.textContent = matchedRule.isRegex
                ? `Pattern: ${matchedRule.pattern} (Regex)`
                : `Domain: ${matchedRule.pattern}`;
        }
    } else {
        activeRuleView.style.display = "none";
        createRuleView.style.display = "block";
    }
};

const init = async () => {
    config = await readProfilesConfig();
    updateProfileView();
    testConnection();

    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        if (tab && tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
            currentDomain = extractHostname(tab.url);
        } else {
            currentDomain = "";
        }
    } catch (e) {
        currentDomain = "";
    }

    await updateSiteRuleView();

    const profileSelect = document.getElementById("profile-select");
    if (profileSelect) {
        profileSelect.addEventListener("change", async () => {
            config.activeProfileId = profileSelect.value;
            await saveProfilesConfig(config);
            updateProfileView();
            await testConnection();
        });
    }

    const removeRuleBtn = document.getElementById("remove-rule-btn");
    if (removeRuleBtn) {
        removeRuleBtn.addEventListener("click", async () => {
            if (matchedRule) {
                await removeRoutingRule(matchedRule.id);
                matchedRule = null;
                await updateSiteRuleView();
            }
        });
    }

    const addRuleBtn = document.getElementById("add-rule-btn");
    if (addRuleBtn) {
        addRuleBtn.addEventListener("click", async () => {
            if (!currentDomain) return;
            const actionEl = document.getElementById("rule-action");
            const durationEl = document.getElementById("rule-duration");
            const action = actionEl ? actionEl.value : "aria2";
            const duration = durationEl ? durationEl.value : "permanent";

            await addRoutingRule({
                pattern: currentDomain,
                isRegex: false,
                action,
                duration,
                profileId: config.activeProfileId
            });
            await updateSiteRuleView();
        });
    }

    const openOptions = () => {
        browser.runtime.openOptionsPage();
        window.close();
    };

    const openOptionsBtn = document.getElementById("open-options-btn");
    if (openOptionsBtn) {
        openOptionsBtn.addEventListener("click", openOptions);
    }

    const footerOptionsBtn = document.getElementById("footer-options-btn");
    if (footerOptionsBtn) {
        footerOptionsBtn.addEventListener("click", openOptions);
    }
};

document.addEventListener("DOMContentLoaded", init);
