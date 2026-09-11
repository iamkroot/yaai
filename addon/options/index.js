import {
    readProfilesConfig,
    saveProfilesConfig,
    generateProfileId,
    DEFAULT_PROFILE,
    clearRecentDirs,
    readRoutingRules,
    addRoutingRule,
    removeRoutingRule
} from "../common/utils.js";
import { Aria2 } from "../common/aria2.js";

const form = document.getElementById("aria2-options");
const profileSelect = document.getElementById("profile-select");
const newProfileBtn = document.getElementById("new-profile-btn");
const makeDefaultBtn = document.getElementById("make-default-btn");
const deleteProfileBtn = document.getElementById("delete-profile-btn");
const profileBadge = document.getElementById("profile-badge");
const testConnectionBtn = document.getElementById("test-connection-btn");
const statusMessage = document.getElementById("status-message");
const recentDirsContainer = document.getElementById("recent-dirs-container");
const clearHistoryBtn = document.getElementById("clear-history-btn");

const rulesTable = document.getElementById("rules-table");
const rulesList = document.getElementById("rules-list");
const noRulesMsg = document.getElementById("no-rules-message");
const newRulePattern = document.getElementById("new-rule-pattern");
const newRuleRegex = document.getElementById("new-rule-regex");
const newRuleAction = document.getElementById("new-rule-action");
const newRuleDuration = document.getElementById("new-rule-duration");
const addRuleBtn = document.getElementById("add-rule-btn");
const ruleStatusMsg = document.getElementById("rule-status-message");

let config = { profiles: [], activeProfileId: "default" };
let currentEditingProfileId = "default";
let statusTimer = null;

const showMessage = (msg, type = "info") => {
    if (statusTimer) clearTimeout(statusTimer);
    statusMessage.textContent = msg;
    if (type === "success") {
        statusMessage.style.color = "#107c10";
    } else if (type === "error") {
        statusMessage.style.color = "#d9383a";
    } else {
        statusMessage.style.color = "#0060df";
    }
    if (type === "success" || type === "info") {
        statusTimer = setTimeout(() => {
            statusMessage.textContent = "";
        }, 5000);
    }
};

const renderProfileSelect = () => {
    profileSelect.innerHTML = "";
    for (const profile of config.profiles) {
        const option = document.createElement("option");
        option.value = profile.id;
        const isDefault = profile.id === config.activeProfileId;
        option.textContent = isDefault ? `${profile.name} (Default)` : profile.name;
        profileSelect.appendChild(option);
    }

    profileSelect.value = currentEditingProfileId;

    const isCurrentDefault = currentEditingProfileId === config.activeProfileId;
    if (isCurrentDefault) {
        profileBadge.textContent = "★ Active default server profile";
        makeDefaultBtn.disabled = true;
    } else {
        profileBadge.textContent = "";
        makeDefaultBtn.disabled = false;
    }

    deleteProfileBtn.disabled = config.profiles.length <= 1;
};

const populateForm = (profile) => {
    if (!profile) return;
    for (const element of form.querySelectorAll(".option.aria2")) {
        const value = profile[element.name];
        if (element.name === "secure") {
            element.checked = Boolean(value);
        } else if (element.name === "protocol") {
            if (element.id.endsWith(value || "http")) {
                element.checked = true;
            }
        } else {
            element.value = value ?? "";
        }
    }

    if (recentDirsContainer && clearHistoryBtn) {
        if (Array.isArray(profile.recentDirs) && profile.recentDirs.length > 0) {
            recentDirsContainer.innerHTML = profile.recentDirs.map(d => `<div style="padding: 2px 0;">• ${d}</div>`).join("");
            clearHistoryBtn.disabled = false;
        } else {
            recentDirsContainer.textContent = "(None)";
            clearHistoryBtn.disabled = true;
        }
    }
};

const loadOptions = async () => {
    config = await readProfilesConfig();
    currentEditingProfileId = config.activeProfileId;
    renderProfileSelect();
    const current = config.profiles.find(p => p.id === currentEditingProfileId) || config.profiles[0];
    populateForm(current);
    await renderRoutingRules();
};

const handleProfileChange = () => {
    currentEditingProfileId = profileSelect.value;
    const profile = config.profiles.find(p => p.id === currentEditingProfileId);
    populateForm(profile);
    const isCurrentDefault = currentEditingProfileId === config.activeProfileId;
    if (isCurrentDefault) {
        profileBadge.textContent = "★ Active default server profile";
        makeDefaultBtn.disabled = true;
    } else {
        profileBadge.textContent = "";
        makeDefaultBtn.disabled = false;
    }
    statusMessage.textContent = "";
};

const handleNewProfile = async () => {
    const newId = generateProfileId();
    const count = config.profiles.length + 1;
    const newProfile = {
        ...DEFAULT_PROFILE,
        id: newId,
        name: `Profile ${count}`,
        recentDirs: []
    };

    config.profiles.push(newProfile);
    currentEditingProfileId = newId;

    await saveProfilesConfig(config);
    renderProfileSelect();
    populateForm(newProfile);

    const nameInput = document.getElementById("name");
    if (nameInput) {
        nameInput.focus();
        nameInput.select();
    }
    showMessage(`Created "${newProfile.name}". Configure settings and click Save Profile.`, "info");
};

const handleMakeDefault = async () => {
    config.activeProfileId = currentEditingProfileId;
    await saveProfilesConfig(config);
    renderProfileSelect();
    showMessage("Set as active default profile!", "success");
};

const handleDeleteProfile = async () => {
    if (config.profiles.length <= 1) return;

    const currentProfile = config.profiles.find(p => p.id === currentEditingProfileId);
    const profileName = currentProfile ? currentProfile.name : "this profile";
    const confirmed = window.confirm(`Are you sure you want to delete profile "${profileName}"?`);
    if (!confirmed) return;

    config.profiles = config.profiles.filter(p => p.id !== currentEditingProfileId);
    if (config.activeProfileId === currentEditingProfileId) {
        config.activeProfileId = config.profiles[0].id;
    }
    currentEditingProfileId = config.activeProfileId;

    await saveProfilesConfig(config);
    renderProfileSelect();
    const nextProfile = config.profiles.find(p => p.id === currentEditingProfileId);
    populateForm(nextProfile);
    showMessage(`Deleted "${profileName}".`, "info");
};

const handleSaveProfile = async (event) => {
    if (event) event.preventDefault();

    const profileIndex = config.profiles.findIndex(p => p.id === currentEditingProfileId);
    if (profileIndex === -1) return;

    const formData = new FormData(form);
    const updated = { ...config.profiles[profileIndex] };

    for (const [key, value] of formData.entries()) {
        updated[key] = value;
    }

    updated.secure = formData.get("secure") !== null;
    updated.port = parseInt(updated.port, 10) || 6800;
    updated.name = (updated.name || "").trim() || "Profile";
    updated.dir = (updated.dir || "").trim();

    config.profiles[profileIndex] = updated;

    await saveProfilesConfig(config);
    renderProfileSelect();
    showMessage("Profile saved successfully!", "success");
};

const handleClearHistory = async () => {
    const profile = config.profiles.find(p => p.id === currentEditingProfileId);
    if (!profile) return;
    await clearRecentDirs(currentEditingProfileId);
    profile.recentDirs = [];
    populateForm(profile);
    showMessage("Recent directories cleared for this profile.", "info");
};

const handleTestConnection = async () => {
    const formData = new FormData(form);
    const testOptions = {
        host: formData.get("host") || "localhost",
        port: parseInt(formData.get("port"), 10) || 6800,
        protocol: formData.get("protocol") || "http",
        secure: formData.get("secure") !== null,
        path: formData.get("path") || "/jsonrpc",
        secret: formData.get("secret") || ""
    };

    showMessage("Testing connection to Aria2...", "info");

    const client = new Aria2(testOptions);
    try {
        const versionInfo = await client.call("getVersion");
        showMessage(`✓ Connected! Aria2 v${versionInfo.version} (${versionInfo.enabledFeatures?.join(", ") || "RPC"})`, "success");
    } catch (err) {
        showMessage(`✗ Connection failed: ${err.message}`, "error");
    } finally {
        client.close();
    }
};

const formatExpiry = (expiresAt) => {
    if (expiresAt === "session") {
        return "This session";
    }
    if (!expiresAt) {
        return "Permanent";
    }
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) {
        return "Expired";
    }
    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins < 60) {
        return `${diffMins}m remaining`;
    }
    const diffHours = Math.ceil(diffMs / 3600000);
    return `${diffHours}h remaining`;
};

const renderRoutingRules = async () => {
    if (!rulesTable || !rulesList || !noRulesMsg) return;
    const rules = await readRoutingRules();
    rulesList.innerHTML = "";

    if (rules.length === 0) {
        rulesTable.style.display = "none";
        noRulesMsg.style.display = "block";
        return;
    }

    rulesTable.style.display = "table";
    noRulesMsg.style.display = "none";

    for (const rule of rules) {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";

        const typeBadge = rule.isRegex
            ? `<span style="background: #e8eaed; color: #3c4043; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; font-family: monospace;">Regex</span>`
            : `<span style="background: #e8f0fe; color: #1a73e8; padding: 2px 6px; border-radius: 3px; font-size: 0.85em;">Domain</span>`;

        const actionBadge = rule.action === "aria2"
            ? `<span style="background: #e1f5fe; color: #0277bd; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 0.85em;">Aria2</span>`
            : `<span style="background: #fff3e0; color: #e65100; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 0.85em;">Firefox</span>`;

        const expiryText = formatExpiry(rule.expiresAt);

        tr.innerHTML = `
            <td style="padding: 8px 10px; font-family: monospace; word-break: break-all;">${rule.pattern}</td>
            <td style="padding: 8px 10px;">${typeBadge}</td>
            <td style="padding: 8px 10px;">${actionBadge}</td>
            <td style="padding: 8px 10px; color: #555;">${expiryText}</td>
            <td style="padding: 8px 10px; text-align: right;">
                <button type="button" class="browser-style delete-rule-btn" style="color: #c00; font-size: 0.85em; padding: 2px 8px;" data-id="${rule.id}">Delete</button>
            </td>
        `;

        const delBtn = tr.querySelector(".delete-rule-btn");
        if (delBtn) {
            delBtn.addEventListener("click", async () => {
                await removeRoutingRule(rule.id);
                await renderRoutingRules();
            });
        }

        rulesList.appendChild(tr);
    }
};

let ruleStatusTimer = null;
const showRuleMessage = (msg, isError = false) => {
    if (!ruleStatusMsg) return;
    if (ruleStatusTimer) clearTimeout(ruleStatusTimer);
    ruleStatusMsg.textContent = msg;
    ruleStatusMsg.style.color = isError ? "#d9383a" : "#107c10";
    ruleStatusTimer = setTimeout(() => {
        ruleStatusMsg.textContent = "";
    }, 4000);
};

const handleAddRule = async () => {
    if (!newRulePattern) return;
    const pattern = (newRulePattern.value || "").trim();
    if (!pattern) {
        showRuleMessage("Please enter a domain or URL pattern.", true);
        newRulePattern.focus();
        return;
    }

    const isRegex = newRuleRegex ? newRuleRegex.checked : false;
    if (isRegex) {
        try {
            new RegExp(pattern);
        } catch (e) {
            showRuleMessage(`Invalid regular expression: ${e.message}`, true);
            newRulePattern.focus();
            return;
        }
    }

    try {
        await addRoutingRule({
            pattern,
            isRegex,
            action: newRuleAction ? newRuleAction.value : "aria2",
            duration: newRuleDuration ? newRuleDuration.value : "permanent",
            profileId: config.activeProfileId
        });
        newRulePattern.value = "";
        if (newRuleRegex) newRuleRegex.checked = false;
        await renderRoutingRules();
        showRuleMessage("Rule added successfully!", false);
    } catch (e) {
        showRuleMessage(e.message || "Failed to add rule.", true);
    }
};

document.addEventListener("DOMContentLoaded", loadOptions);
profileSelect.addEventListener("change", handleProfileChange);
newProfileBtn.addEventListener("click", handleNewProfile);
makeDefaultBtn.addEventListener("click", handleMakeDefault);
deleteProfileBtn.addEventListener("click", handleDeleteProfile);
form.addEventListener("submit", handleSaveProfile);
testConnectionBtn.addEventListener("click", handleTestConnection);
clearHistoryBtn.addEventListener("click", handleClearHistory);

if (addRuleBtn) {
    addRuleBtn.addEventListener("click", handleAddRule);
}

if (newRulePattern) {
    newRulePattern.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddRule();
        }
    });
}
