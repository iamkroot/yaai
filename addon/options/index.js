import {
    readProfilesConfig,
    saveProfilesConfig,
    generateProfileId,
    DEFAULT_PROFILE
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
};

const loadOptions = async () => {
    config = await readProfilesConfig();
    currentEditingProfileId = config.activeProfileId;
    renderProfileSelect();
    const current = config.profiles.find(p => p.id === currentEditingProfileId) || config.profiles[0];
    populateForm(current);
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
        name: `Profile ${count}`
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

document.addEventListener("DOMContentLoaded", loadOptions);
profileSelect.addEventListener("change", handleProfileChange);
newProfileBtn.addEventListener("click", handleNewProfile);
makeDefaultBtn.addEventListener("click", handleMakeDefault);
deleteProfileBtn.addEventListener("click", handleDeleteProfile);
form.addEventListener("submit", handleSaveProfile);
testConnectionBtn.addEventListener("click", handleTestConnection);
