const DIALOG_HTML = `
<dialog id="yaai-dialog" style="max-height: 40%; z-index: 2147483647; margin: auto; position: fixed;">
    <form method="dialog" class="pure-form pure-form-stacked">
        <fieldset>
            <legend>Intercepted download</legend>
            <label for="yaai-url">URL</label>
            <input class="pure-input-1" type="text" name="yaai-url" id="yaai-url" readonly="">
            <label for="yaai-filename">Name</label>
            <input class="pure-input-1" type="text" name="yaai-filename" id="yaai-filename">
            <label for="yaai-profile">Server Profile</label>
            <select class="pure-input-1" name="yaai-profile" id="yaai-profile"></select>
            <label for="yaai-dir-select">Location</label>
            <div id="yaai-dir-container" style="margin-bottom: 0.5em;">
                <select class="pure-input-1" id="yaai-dir-select" name="yaai-dir-select"></select>
                <div id="yaai-dir-input-wrapper" style="display: none; position: relative;">
                    <input class="pure-input-1" type="text" name="yaai-dir" id="yaai-dir" placeholder="Enter download directory" style="padding-right: 28px; width: 100%; box-sizing: border-box;">
                    <button type="button" id="yaai-dir-cancel-btn" title="Back to list" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 14px; line-height: 1; color: #888; padding: 4px;">✕</button>
                </div>
            </div>
        </fieldset>
        <button type="submit" value="aria2" class="pure-button pure-button-primary">Aria2</button>
        <button type="submit" value="firefox" class="pure-button">Firefox</button>
        <button type="submit" value="halt" class="pure-button">Don&apos;t Download</button>
    </form>
</dialog>
`;

let currentProfiles = [];
let isCustomMode = false;

const setCustomMode = (custom) => {
    isCustomMode = custom;
    const selectEl = document.getElementById("yaai-dir-select");
    const wrapperEl = document.getElementById("yaai-dir-input-wrapper");
    const inputEl = document.getElementById("yaai-dir");
    if (!selectEl || !wrapperEl) return;

    if (custom) {
        selectEl.style.display = "none";
        wrapperEl.style.display = "block";
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    } else {
        wrapperEl.style.display = "none";
        selectEl.style.display = "block";
    }
};

const renderDirSelect = (profileId, selectedValue) => {
    const dirSelect = document.getElementById("yaai-dir-select");
    if (!dirSelect) return;
    dirSelect.innerHTML = "";

    const profile = currentProfiles.find(p => p.id === profileId);
    const defaultDir = (profile && profile.dir) || "";
    const recentDirs = (profile && Array.isArray(profile.recentDirs)) ? profile.recentDirs : [];

    // Default option
    const defaultOpt = document.createElement("option");
    defaultOpt.value = defaultDir;
    defaultOpt.textContent = defaultDir ? `Default (${defaultDir})` : "Default (Server global option)";
    dirSelect.appendChild(defaultOpt);

    // Recent directories
    if (recentDirs.length > 0) {
        const group = document.createElement("optgroup");
        group.label = "Recent Locations";
        for (const rDir of recentDirs) {
            if (rDir !== defaultDir) {
                const opt = document.createElement("option");
                opt.value = rDir;
                opt.textContent = rDir;
                group.appendChild(opt);
            }
        }
        if (group.children.length > 0) {
            dirSelect.appendChild(group);
        }
    }

    // Custom option
    const customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "Custom location...";
    dirSelect.appendChild(customOpt);

    // Select matched option
    let matched = false;
    if (selectedValue !== undefined) {
        for (const opt of dirSelect.querySelectorAll("option")) {
            if (opt.value !== "__custom__" && opt.value === selectedValue) {
                dirSelect.value = opt.value;
                matched = true;
                break;
            }
        }
    }
    if (!matched) {
        dirSelect.value = defaultDir;
    }
};

/**
 * Get or create the dialog box
 */
const insertDialog = () => {
    let dialog = document.getElementById("yaai-dialog");
    if (dialog !== null) {
        // Replace old dialog if DOM structure has changed
        if (!document.getElementById("yaai-dir-input-wrapper")) {
            dialog.remove();
            dialog = null;
        } else {
            return dialog;
        }
    }
    document.body.insertAdjacentHTML("beforeend", DIALOG_HTML);
    dialog = document.getElementById("yaai-dialog");

    const dirEl = document.getElementById("yaai-dir");
    const dirSelect = document.getElementById("yaai-dir-select");
    const cancelBtn = document.getElementById("yaai-dir-cancel-btn");
    const profileEl = document.getElementById("yaai-profile");

    if (dirSelect && dirEl) {
        dirSelect.addEventListener("change", () => {
            if (dirSelect.value === "__custom__") {
                setCustomMode(true);
            } else {
                dirEl.value = dirSelect.value;
            }
        });
    }

    if (cancelBtn && dirSelect && dirEl) {
        cancelBtn.addEventListener("click", () => {
            setCustomMode(false);
            const profile = currentProfiles.find(p => p.id === (profileEl ? profileEl.value : ""));
            const defaultDir = (profile && profile.dir) || "";
            dirSelect.value = defaultDir;
            dirEl.value = defaultDir;
        });
    }

    if (profileEl && dirEl) {
        profileEl.addEventListener("change", () => {
            setCustomMode(false);
            const profile = currentProfiles.find(p => p.id === profileEl.value);
            const defaultDir = (profile && profile.dir) || "";
            renderDirSelect(profileEl.value, defaultDir);
            dirEl.value = defaultDir;
        });
    }

    return dialog;
};

/**
 * Add values to the dialog fields
 * @param {any} params 
 * @param {HTMLDialogElement} dialog 
 */
const populateDialog = (params, dialog) => {
    setCustomMode(false);
    currentProfiles = Array.isArray(params.profiles) ? params.profiles : [];

    for (const param of ["url", "filename"]) {
        const el = document.getElementById("yaai-" + param);
        if (el) {
            el.value = params[param] || "";
        }
    }

    const dirEl = document.getElementById("yaai-dir");
    if (dirEl) {
        dirEl.value = params.dir || "";
    }

    const profileEl = document.getElementById("yaai-profile");
    if (profileEl) {
        profileEl.innerHTML = "";
        if (currentProfiles.length > 0) {
            for (const profile of currentProfiles) {
                const opt = document.createElement("option");
                opt.value = profile.id;
                opt.textContent = profile.name;
                opt.dataset.dir = profile.dir || "";
                profileEl.appendChild(opt);
            }
            if (params.selectedProfileId) {
                profileEl.value = params.selectedProfileId;
            }
        }
    }

    const targetProfileId = profileEl ? profileEl.value : params.selectedProfileId;
    renderDirSelect(targetProfileId, params.dir || "");

    dialog.returnValue = "";
    dialog.removeAttribute("open");
};

const DEFAULT_METHOD = "firefox";

/**
 * Retrieve the form values and user selection from dialog
 * @param {HTMLDialogElement} dialog 
 */
const getUserInput = (dialog) => new Promise((resolve) => {
    dialog.addEventListener("close", () => {
        let params = {};
        for (const param of ["url", "filename"]) {
            const el = document.getElementById("yaai-" + param);
            params[param] = el ? el.value : "";
        }

        const profileEl = document.getElementById("yaai-profile");
        params.profileId = profileEl ? profileEl.value : "";

        const dirSelect = document.getElementById("yaai-dir-select");
        const dirInput = document.getElementById("yaai-dir");

        if (isCustomMode && dirInput) {
            params.dir = dirInput.value.trim();
        } else if (dirSelect && dirSelect.value !== "__custom__") {
            params.dir = dirSelect.value;
        } else if (dirInput) {
            params.dir = dirInput.value.trim();
        } else {
            params.dir = "";
        }

        const val = dialog.returnValue || DEFAULT_METHOD;
        populateDialog({}, dialog); // clear the dialog for future use.
        resolve({ params, downloadMethod: val });
    }, { once: true });
});

/**
 * Show a popup and get user's confirmation
 * @param {any} params The details of the intercepted download
 */
const confirmDownload = async (params) => {
    const dialog = insertDialog();
    populateDialog(params, dialog);
    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        dialog.setAttribute("open", "");
    }
    return await getUserInput(dialog);
};

browser.runtime.onMessage.addListener((data) => {
    if (data && data.action === "confirmDownload") {
        return confirmDownload(data.params);
    }
});
