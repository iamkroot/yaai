(() => {
    if (window.__yaai_popup_initialized) {
        return;
    }
    window.__yaai_popup_initialized = true;

    const createDialogElement = () => {
        const dialog = document.createElement("dialog");
        dialog.id = "yaai-dialog";
        dialog.style.cssText = "max-width: 95vw; max-height: 85vh; overflow-y: auto; z-index: 2147483647; margin: auto; position: fixed; box-sizing: border-box;";

        const form = document.createElement("form");
        form.setAttribute("method", "dialog");
        form.className = "pure-form pure-form-stacked";

        const fieldset = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = "Intercepted download";
        fieldset.appendChild(legend);

        // URL
        const urlLabel = document.createElement("label");
        urlLabel.setAttribute("for", "yaai-url");
        urlLabel.textContent = "URL";
        const urlInput = document.createElement("input");
        urlInput.className = "pure-input-1";
        urlInput.type = "text";
        urlInput.name = "yaai-url";
        urlInput.id = "yaai-url";
        urlInput.readOnly = true;
        fieldset.appendChild(urlLabel);
        fieldset.appendChild(urlInput);

        // Name
        const nameLabel = document.createElement("label");
        nameLabel.setAttribute("for", "yaai-filename");
        nameLabel.textContent = "Name";
        const nameInput = document.createElement("input");
        nameInput.className = "pure-input-1";
        nameInput.type = "text";
        nameInput.name = "yaai-filename";
        nameInput.id = "yaai-filename";
        fieldset.appendChild(nameLabel);
        fieldset.appendChild(nameInput);

        // Server Profile
        const profileLabel = document.createElement("label");
        profileLabel.setAttribute("for", "yaai-profile");
        profileLabel.textContent = "Server Profile";
        const profileSelect = document.createElement("select");
        profileSelect.className = "pure-input-1";
        profileSelect.name = "yaai-profile";
        profileSelect.id = "yaai-profile";
        fieldset.appendChild(profileLabel);
        fieldset.appendChild(profileSelect);

        // Location
        const dirLabel = document.createElement("label");
        dirLabel.setAttribute("for", "yaai-dir-select");
        dirLabel.textContent = "Location";
        const dirContainer = document.createElement("div");
        dirContainer.id = "yaai-dir-container";
        dirContainer.style.marginBottom = "0.5em";

        const dirSelect = document.createElement("select");
        dirSelect.className = "pure-input-1";
        dirSelect.id = "yaai-dir-select";
        dirSelect.name = "yaai-dir-select";
        dirContainer.appendChild(dirSelect);

        const dirInputWrapper = document.createElement("div");
        dirInputWrapper.id = "yaai-dir-input-wrapper";
        dirInputWrapper.style.cssText = "display: none; position: relative;";

        const dirInput = document.createElement("input");
        dirInput.className = "pure-input-1";
        dirInput.type = "text";
        dirInput.name = "yaai-dir";
        dirInput.id = "yaai-dir";
        dirInput.placeholder = "Enter download directory";
        dirInput.style.cssText = "padding-right: 28px; width: 100%; box-sizing: border-box;";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.id = "yaai-dir-cancel-btn";
        cancelBtn.title = "Back to list";
        cancelBtn.textContent = "✕";
        cancelBtn.style.cssText = "position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 14px; line-height: 1; color: #888; padding: 4px;";

        dirInputWrapper.appendChild(dirInput);
        dirInputWrapper.appendChild(cancelBtn);
        dirContainer.appendChild(dirInputWrapper);

        fieldset.appendChild(dirLabel);
        fieldset.appendChild(dirContainer);
        form.appendChild(fieldset);

        // Buttons row
        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; align-items: center;";

        // Aria2 split button
        const ariaGroup = document.createElement("div");
        ariaGroup.style.cssText = "position: relative; display: inline-flex;";

        const ariaBtn = document.createElement("button");
        ariaBtn.type = "submit";
        ariaBtn.value = "aria2";
        ariaBtn.className = "pure-button pure-button-primary";
        ariaBtn.textContent = "Aria2";

        const ariaMenuBtn = document.createElement("button");
        ariaMenuBtn.type = "button";
        ariaMenuBtn.id = "yaai-aria2-menu-btn";
        ariaMenuBtn.className = "pure-button pure-button-primary";
        ariaMenuBtn.style.cssText = "padding: 0 8px; border-left: 1px solid rgba(255,255,255,0.4);";
        ariaMenuBtn.title = "Remember Aria2 for this site";
        ariaMenuBtn.textContent = "▾";

        const ariaMenu = document.createElement("div");
        ariaMenu.id = "yaai-aria2-menu";
        ariaMenu.style.cssText = "display: none; position: absolute; bottom: 100%; left: 0; margin-bottom: 4px; background: #fff; color: #333; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border-radius: 4px; padding: 4px 0; z-index: 2147483647; min-width: 240px; font-size: 12px;";

        ariaGroup.appendChild(ariaBtn);
        ariaGroup.appendChild(ariaMenuBtn);
        ariaGroup.appendChild(ariaMenu);

        // Firefox split button
        const ffGroup = document.createElement("div");
        ffGroup.style.cssText = "position: relative; display: inline-flex;";

        const ffBtn = document.createElement("button");
        ffBtn.type = "submit";
        ffBtn.value = "firefox";
        ffBtn.className = "pure-button";
        ffBtn.textContent = "Firefox";

        const ffMenuBtn = document.createElement("button");
        ffMenuBtn.type = "button";
        ffMenuBtn.id = "yaai-firefox-menu-btn";
        ffMenuBtn.className = "pure-button";
        ffMenuBtn.style.cssText = "padding: 0 8px; border-left: 1px solid rgba(0,0,0,0.15);";
        ffMenuBtn.title = "Remember Firefox for this site";
        ffMenuBtn.textContent = "▾";

        const ffMenu = document.createElement("div");
        ffMenu.id = "yaai-firefox-menu";
        ffMenu.style.cssText = "display: none; position: absolute; bottom: 100%; left: 0; margin-bottom: 4px; background: #fff; color: #333; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border-radius: 4px; padding: 4px 0; z-index: 2147483647; min-width: 240px; font-size: 12px;";

        ffGroup.appendChild(ffBtn);
        ffGroup.appendChild(ffMenuBtn);
        ffGroup.appendChild(ffMenu);

        // Don't download button
        const haltBtn = document.createElement("button");
        haltBtn.type = "submit";
        haltBtn.value = "halt";
        haltBtn.className = "pure-button";
        haltBtn.textContent = "Don't Download";

        btnRow.appendChild(ariaGroup);
        btnRow.appendChild(ffGroup);
        btnRow.appendChild(haltBtn);

        form.appendChild(btnRow);
        dialog.appendChild(form);

        return dialog;
    };

    let currentProfiles = [];
    let isCustomMode = false;
    let selectedRule = null;
    let currentPageDomain = "";

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
        dirSelect.replaceChildren();

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

    const setupMenu = (action, domain) => {
        const menu = document.getElementById(`yaai-${action}-menu`);
        if (!menu) return;
        menu.replaceChildren();
        const labelAction = action === "aria2" ? "Aria2" : "Firefox";

        const options = [
            { label: domain ? `Always use ${labelAction} for ${domain}` : `Always use ${labelAction} for this site`, duration: "permanent" },
            { label: `Use ${labelAction} for next 15 minutes`, duration: "15" },
            { label: `Use ${labelAction} for this session`, duration: "session" }
        ];

        for (const opt of options) {
            const item = document.createElement("div");
            item.textContent = opt.label;
            item.style.cssText = "padding: 6px 12px; cursor: pointer; white-space: nowrap;";
            item.addEventListener("mouseenter", () => {
                item.style.background = "#f0f4ff";
                item.style.color = "#0060df";
            });
            item.addEventListener("mouseleave", () => {
                item.style.background = "transparent";
                item.style.color = "#333";
            });
            item.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectedRule = {
                    pattern: domain || "",
                    action,
                    duration: opt.duration
                };
                menu.style.display = "none";
                const dialog = document.getElementById("yaai-dialog");
                if (dialog) {
                    dialog.returnValue = action;
                    dialog.close();
                }
            });
            menu.appendChild(item);
        }
    };

    const closeAllMenus = () => {
        const ariaMenu = document.getElementById("yaai-aria2-menu");
        const ffMenu = document.getElementById("yaai-firefox-menu");
        if (ariaMenu) ariaMenu.style.display = "none";
        if (ffMenu) ffMenu.style.display = "none";
    };

    /**
     * Get or create the dialog box
     */
    const insertDialog = () => {
        let dialog = document.getElementById("yaai-dialog");
        if (dialog !== null) {
            if (!document.getElementById("yaai-aria2-menu-btn")) {
                dialog.remove();
                dialog = null;
            } else {
                return dialog;
            }
        }
        dialog = createDialogElement();
        document.body.appendChild(dialog);

        const dirEl = document.getElementById("yaai-dir");
        const dirSelect = document.getElementById("yaai-dir-select");
        const cancelBtn = document.getElementById("yaai-dir-cancel-btn");
        const profileEl = document.getElementById("yaai-profile");

        const ariaMenuBtn = document.getElementById("yaai-aria2-menu-btn");
        const ariaMenu = document.getElementById("yaai-aria2-menu");
        const ffMenuBtn = document.getElementById("yaai-firefox-menu-btn");
        const ffMenu = document.getElementById("yaai-firefox-menu");

        if (ariaMenuBtn && ariaMenu) {
            ariaMenuBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isShown = ariaMenu.style.display === "block";
                closeAllMenus();
                if (!isShown) ariaMenu.style.display = "block";
            });
        }

        if (ffMenuBtn && ffMenu) {
            ffMenuBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isShown = ffMenu.style.display === "block";
                closeAllMenus();
                if (!isShown) ffMenu.style.display = "block";
            });
        }

        dialog.addEventListener("click", (e) => {
            if (!e.target.closest("#yaai-aria2-menu-btn") && !e.target.closest("#yaai-firefox-menu-btn")) {
                closeAllMenus();
            }
        });

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
        closeAllMenus();
        selectedRule = null;
        currentProfiles = Array.isArray(params.profiles) ? params.profiles : [];
        currentPageDomain = params.pageDomain || "";

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
            profileEl.replaceChildren();
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

        setupMenu("aria2", currentPageDomain);
        setupMenu("firefox", currentPageDomain);

        dialog.returnValue = "";
        dialog.removeAttribute("open");
    };

    const DEFAULT_METHOD = "halt";

    /**
     * Retrieve the form values and user selection from dialog
     * @param {HTMLDialogElement} dialog 
     */
    const getUserInput = (dialog) => new Promise((resolve) => {
        dialog.addEventListener("close", () => {
            closeAllMenus();
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
            const ruleToSave = selectedRule;
            populateDialog({}, dialog); // clear the dialog for future use.
            resolve({ params, downloadMethod: val, rule: ruleToSave });
        }, { once: true });
    });

    /**
     * Show a popup and get user's confirmation
     * @param {any} params The details of the intercepted download
     */
    const confirmDownload = async (params) => {
        const dialog = insertDialog();
        populateDialog(params, dialog);
        const inputPromise = getUserInput(dialog);

        if (dialog.open) {
            dialog.close();
        }

        if (typeof dialog.showModal === "function") {
            try {
                dialog.showModal();
            } catch (e) {
                console.warn("YAAI: showModal failed, falling back to open attribute:", e);
                dialog.setAttribute("open", "");
            }
        } else {
            dialog.setAttribute("open", "");
        }

        return await inputPromise;
    };

    browser.runtime.onMessage.addListener((data) => {
        if (data && data.action === "confirmDownload") {
            return confirmDownload(data.params);
        }
    });
})();
