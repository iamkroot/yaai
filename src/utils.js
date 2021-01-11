import { getFilenameFromContentDispositionHeader } from "./content-disposition.js";
const sanitizeFilename = require("sanitize-filename");

/**
 * Create a copy of the given object only containing the specified keys.
 * @param {Object} original Object to copy from
 * @param {string[]} keys The keys to be copied
 */
export const copyObj = (original, keys) => Object.keys(original).reduce((obj, key) => {
    if (keys.includes(key)) {
        obj[key] = original[key];
    }
    return obj;
}, {});

/**
 * Get the value of a header from the list of headers for a given name.
 * @param {Array} headers responseHeaders of webRequest.onHeadersReceived
 * @param {string} name The lowercase name of the header to look for
 * @returns {string?} The value of the header
 */
export const getHeaderVal = (headers, name) => {
    const header = headers.find(x => x.name.toLowerCase() === name);
    return header ? header.value || header.binaryValue || '' : '';
}

const DEFAULT_ARIA2_OPTIONS = {
    host: "localhost",
    protocol: "http",
    port: 6800,
    secure: false,
    path: "/jsonrpc",
    secret: ""
}

export const readAria2Options = async () => {
    const result = await browser.storage.local.get({ aria2_options: DEFAULT_ARIA2_OPTIONS });
    return result.aria2_options;
}

const getFilenameFromURL = (url) => {
    url = url.split(/[?#]/, 1)[0];
    var filename = url.match(/([^/]+)[/ ]*$/)[1];
    try {
        filename = decodeURIComponent(filename);
    } catch (e) {/* URIError */ }
    return filename;
}

export const getFilename = (details) => {
    let filename = "";
    const contentDisp = getHeaderVal(details.responseHeaders, "content-disposition");
    if (contentDisp !== undefined) {
        filename = getFilenameFromContentDispositionHeader(contentDisp)
    }
    if (!filename) {
        filename = getFilenameFromURL(details.url);
    }
    return sanitizeFilename(filename);
}
