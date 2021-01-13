import { getFilename, getHeaderVal } from "./utils.js";
import { readAria2Options } from "./utils";
const Aria2 = require("aria2");

let requests = {};

const REQD_HEADERS = ["Referer", "Cookie", "Cookie2", "Authorization"]

const addToAria = async (params) => {
    const url = params.url;
    let args = {};
    if (params.headers) {
        // convert headers from array of {key: val} to array of "key: val"
        args.header = params.headers.map(header => `${header.name}: ${header.value}`);
    }
    if (params.filename) {
        args.out = params.filename;
    }
    if (params.dir && params.dir != "<default>") {
        args.dir = params.dir;
    }
    let options = await readAria2Options();
    const aria2 = new Aria2(options);
    await aria2.call("addUri", [url], args);
    return true;
}

/**
 * Get user's confirmation and start the download
 * @param {any} respDetails Details of the headers response sent by server
 * @param {any} reqDetails Details of request sent by browser to server
 * @returns {boolean} true if browser download should be cancelled
 */
const startDownload = async (respDetails, reqDetails) => {
    // get headers
    let requestHeaders = "";
    if (reqDetails !== undefined) {
        requestHeaders = reqDetails.requestHeaders.filter(header => REQD_HEADERS.includes(header.name));
    }

    const filename = getFilename(respDetails);

    // show the dialog to user
    let cssUrl = browser.runtime.getURL("res/pure-min.css");
    await browser.tabs.insertCSS(respDetails.tabId, {
        file: cssUrl
    });

    let scriptUrl = browser.runtime.getURL("popup/index.js");
    await browser.tabs.executeScript(respDetails.tabId, {
        file: scriptUrl
    });

    const params = {
        url: respDetails.url,
        filename,
        dir: "<default>",
        headers: requestHeaders
    };

    const userChoice = await browser.tabs.sendMessage(respDetails.tabId, {
        action: "confirmDownload",
        params
    });

    await browser.tabs.removeCSS(respDetails.tabId, { file: cssUrl });

    Object.assign(params, userChoice.params);
    switch (userChoice.downloadMethod) {
        case "aria2":
            try {
                return await addToAria(params);
            } catch (error) {
                console.error("error from aria", error);
                return false;
            }
        case "firefox":
            return false;
        case "halt":
            return true;
        default:
            console.warn("Unknown method", userChoice);
            break;
    }
    return false;
}

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
        return COMMON_TYPES.every(ext => !contentType.startsWith(`application/${ext}`))
    }
    return false;
}

const onHeadersReceived = (details) => {
    if (shouldInterceptDownload(details)) {
        return new Promise(resolve => {
            startDownload(details, requests[details.requestId]).then(shouldCancel => {
                if (shouldCancel)
                    resolve({ cancel: true });
                else
                    resolve();  // no change
            }).finally(() => delete requests[details.requestId]);
        });
    } else {
        delete requests[details.requestId];
    }
    return;  // no change
}

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

