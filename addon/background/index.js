import { getFilename, getHeaderVal, readAria2Options } from "../common/utils.js";
import { Aria2 } from "../common/aria2.js";

let requests = {};
let aria2 = null;
let defaultParams = { dir: "" };

const initAria2 = async () => {
    if (aria2) {
        aria2.close();
    }
    const ariaConnOptions = await readAria2Options();
    aria2 = new Aria2(ariaConnOptions);
    try {
        defaultParams = await aria2.call("getGlobalOption");
    } catch (error) {
        console.warn("YAAI: Could not fetch global options from Aria2 on startup:", error);
    }
};

await initAria2();

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.aria2_options) {
        initAria2();
    }
});

const REQD_HEADERS = ["Referer", "Cookie", "Cookie2", "Authorization"];

const addToAria = async (params) => {
    if (!aria2) {
        await initAria2();
    }
    const url = params.url;
    let args = {};
    if (params.headers && Array.isArray(params.headers)) {
        args.header = params.headers.map(header => `${header.name}: ${header.value}`);
    }
    if (params.filename) {
        args.out = params.filename;
    }
    if (params.dir && params.dir != defaultParams.dir) {
        args.dir = params.dir;
    }
    await aria2.call("addUri", [url], args);
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

    const params = {
        url: respDetails.url,
        filename,
        dir: defaultParams.dir || "",
        headers: requestHeaders
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
