import {
    getFilename,
    getHeaderVal,
    readProfilesConfig,
    getActiveProfile,
    addRecentDir
} from "../common/utils.js";
import { Aria2 } from "../common/aria2.js";

let requests = {};
let currentConfig = { profiles: [], activeProfileId: "default" };
const ariaClients = new Map();
const serverDefaultDirs = new Map();

const getAriaClient = (profile) => {
    if (!profile) return null;
    let client = ariaClients.get(profile.id);
    if (!client) {
        client = new Aria2(profile);
        ariaClients.set(profile.id, client);
    }
    return client;
};

const fetchServerDefaultDir = async (profile) => {
    if (!profile) return "";
    if (profile.dir) {
        return profile.dir;
    }
    if (serverDefaultDirs.has(profile.id)) {
        return serverDefaultDirs.get(profile.id);
    }
    try {
        const client = getAriaClient(profile);
        const options = await client.call("getGlobalOption");
        if (options && options.dir) {
            serverDefaultDirs.set(profile.id, options.dir);
            return options.dir;
        }
    } catch (error) {
        console.warn(`YAAI: Could not fetch global options for profile "${profile.name}":`, error);
    }
    return "";
};

const initProfiles = async () => {
    for (const client of ariaClients.values()) {
        try {
            client.close();
        } catch (e) {
            // Ignore close errors
        }
    }
    ariaClients.clear();
    serverDefaultDirs.clear();

    currentConfig = await readProfilesConfig();

    for (const profile of currentConfig.profiles) {
        fetchServerDefaultDir(profile).catch(() => {});
    }
};

await initProfiles();

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.profiles || changes.active_profile_id || changes.aria2_options)) {
        initProfiles();
    }
});

const REQD_HEADERS = ["Referer", "Cookie", "Cookie2", "Authorization"];

const addToAria = async (params) => {
    const activeProfile = getActiveProfile(currentConfig.profiles, currentConfig.activeProfileId);
    const targetProfile = (params.profileId && currentConfig.profiles.find(p => p.id === params.profileId)) || activeProfile;

    const client = getAriaClient(targetProfile);
    if (!client) {
        throw new Error("No Aria2 client available");
    }

    const url = params.url;
    let args = {};
    if (params.headers && Array.isArray(params.headers)) {
        args.header = params.headers.map(header => `${header.name}: ${header.value}`);
    }
    if (params.filename) {
        args.out = params.filename;
    }

    const targetDefaultDir = targetProfile.dir || serverDefaultDirs.get(targetProfile.id) || "";
    if (params.dir && params.dir !== targetDefaultDir) {
        args.dir = params.dir;
    }

    await client.call("addUri", [url], args);

    if (params.dir && typeof params.dir === "string" && params.dir.trim()) {
        addRecentDir(targetProfile.id, params.dir).catch(err => {
            console.warn("YAAI: Failed to add recent dir:", err);
        });
    }

    return true;
};

/**
 * Get user's confirmation and start the download
 * @param {any} respDetails Details of the headers response sent by server
 * @param {any} reqDetails Details of request sent by browser to server
 * @returns {boolean} true if browser download should be cancelled
 */
const startDownload = async (respDetails, reqDetails) => {
    if (respDetails.tabId === undefined || respDetails.tabId < 0) {
        console.warn("YAAI: Download intercepted without a valid tab (tabId=" + respDetails.tabId + ")");
        return false;
    }

    // get headers
    let requestHeaders = [];
    if (reqDetails !== undefined && Array.isArray(reqDetails.requestHeaders)) {
        requestHeaders = reqDetails.requestHeaders.filter(header => REQD_HEADERS.includes(header.name));
    }

    const filename = getFilename(respDetails);

    const CSS_FILE = "/res/pure-min.css";
    const SCRIPT_FILE = "/popup/index.js";

    // show the dialog to user
    try {
        await browser.tabs.insertCSS(respDetails.tabId, { file: CSS_FILE });
    } catch (e) {
        console.warn("YAAI: Failed to insert CSS:", e);
    }

    try {
        await browser.tabs.executeScript(respDetails.tabId, { file: SCRIPT_FILE });
    } catch (e) {
        console.warn("YAAI: Failed to execute popup script into tab:", e);
        return false;
    }

    const activeProfile = getActiveProfile(currentConfig.profiles, currentConfig.activeProfileId);
    let activeDir = activeProfile.dir || serverDefaultDirs.get(activeProfile.id);
    if (!activeDir) {
        activeDir = await fetchServerDefaultDir(activeProfile);
    }

    const profileList = currentConfig.profiles.map(p => ({
        id: p.id,
        name: p.name,
        dir: p.dir || serverDefaultDirs.get(p.id) || "",
        recentDirs: Array.isArray(p.recentDirs) ? p.recentDirs : []
    }));

    const params = {
        url: respDetails.url,
        filename,
        dir: activeDir || "",
        headers: requestHeaders,
        profiles: profileList,
        selectedProfileId: activeProfile.id
    };

    let userChoice;
    try {
        userChoice = await browser.tabs.sendMessage(respDetails.tabId, {
            action: "confirmDownload",
            params
        });
    } catch (e) {
        console.warn("YAAI: Failed to receive confirmation from dialog:", e);
        return false;
    } finally {
        try {
            await browser.tabs.removeCSS(respDetails.tabId, { file: CSS_FILE });
        } catch (e) {
            // Ignore removeCSS errors
        }
    }

    if (!userChoice || typeof userChoice !== "object") {
        return false;
    }

    if (userChoice.params) {
        Object.assign(params, userChoice.params);
    }

    switch (userChoice.downloadMethod) {
        case "aria2":
            try {
                return await addToAria(params);
            } catch (error) {
                console.error("YAAI: Error sending to Aria2:", error);
                try {
                    await browser.notifications.create({
                        type: "basic",
                        iconUrl: "/res/download-48.png",
                        title: "YAAI: Failed to send to Aria2",
                        message: error.message || "Could not connect to Aria2 server"
                    });
                } catch (notifyErr) {
                    // Ignore notification errors
                }
                return false;
            }
        case "firefox":
            return false;
        case "halt":
            return true;
        default:
            console.warn("YAAI: Unknown download method:", userChoice);
            return false;
    }
};

const COMMON_TYPES = ["pdf", "xhtml", "x-xpinstall", "x-shockwave-flash", "rss", "json"];

const shouldInterceptDownload = (details) => {
    if (details.statusCode != 200) {
        return false;
    }

    const contentDisp = getHeaderVal(details.responseHeaders, "content-disposition");
    if (contentDisp.startsWith("attachment")) {
        return true;
    }
    const contentType = getHeaderVal(details.responseHeaders, "content-type");
    if (contentType.startsWith("application")) {
        return COMMON_TYPES.every(ext => !contentType.startsWith(`application/${ext}`));
    }
    return false;
};

const onHeadersReceived = (details) => {
    if (shouldInterceptDownload(details)) {
        return new Promise(resolve => {
            startDownload(details, requests[details.requestId])
                .then(shouldCancel => {
                    if (shouldCancel)
                        resolve({ cancel: true });
                    else
                        resolve();  // no change
                })
                .catch(err => {
                    console.error("YAAI: startDownload unhandled error:", err);
                    resolve(); // Let browser download normally on error
                })
                .finally(() => delete requests[details.requestId]);
        });
    } else {
        delete requests[details.requestId];
    }
    return;  // no change
};

const RES_TYPES = ["main_frame", "sub_frame"];

browser.webRequest.onSendHeaders.addListener(
    (details) => {
        requests[details.requestId] = details;
    },
    {
        urls: ["<all_urls>"],
        types: RES_TYPES
    },
    ["requestHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    {
        urls: ["<all_urls>"],
        types: RES_TYPES
    },
    ["blocking", "responseHeaders"]
);

browser.webRequest.onErrorOccurred.addListener(
    (details) => {
        delete requests[details.requestId];
    },
    {
        urls: ["<all_urls>"],
        types: RES_TYPES
    }
);
