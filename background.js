import { copyObj, getFilename, getHeaderVal } from "./utils.js";

let requests = {};

const REQD_HEADERS = ["Referer", "Cookie", "Cookie2", "Authorization"]


const startDownload = async (respDetails, reqDetails) => {
    let newReq = { ...reqDetails };

    // get headers
    if (reqDetails !== undefined) {
        newReq.requestHeaders = copyObj(reqDetails.requestHeaders, REQD_HEADERS);
    } else {
        newReq.requestHeaders = "";
    }
    newReq.fileName = getFilename(respDetails);
}

const onSendHeaders = (details) => {
    requests[details.requestId] = details;
}

const COMMON_TYPES = ["pdf", "xhtml", "x-xpinstall", "x-shockwave-flash", "rss", "json"];


const shouldHijackDownload = (details) => {
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
    try {
        if (shouldHijackDownload(details)) {
            startDownload(details, requests[details.requestId]);
            return { cancel: true };
        }
    } finally {
        delete requests[details.requestId];
    }
    return;  // no change
}

const RES_TYPES = ["main_frame", "sub_frame"];

browser.webRequest.onSendHeaders.addListener(
    onSendHeaders,
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

