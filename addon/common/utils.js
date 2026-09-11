import { getFilenameFromContentDispositionHeader } from "./content-disposition.js";

function truncateUtf8(str, maxBytes = 255) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    if (encoded.length <= maxBytes) return str;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(encoded.subarray(0, maxBytes)).replace(/\uFFFD$/, "");
}

const ILLEGAL_RE = /[\/\?<>\\:\*\|"]/g;
const CONTROL_RE = /[\x00-\x1f\x80-\x9f]/g;
const RESERVED_RE = /^\.+$/;
const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

export function sanitizeFilename(input, replacement = "") {
    if (typeof input !== "string") {
        throw new TypeError("Input must be string");
    }
    let sanitized = input
        .replace(ILLEGAL_RE, replacement)
        .replace(CONTROL_RE, replacement)
        .replace(RESERVED_RE, replacement)
        .replace(WINDOWS_RESERVED_RE, replacement);
    sanitized = sanitized.replace(/[. ]+$/, "");
    return truncateUtf8(sanitized, 255);
}

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
 * @returns {string} The value of the header
 */
export const getHeaderVal = (headers, name) => {
    const header = headers.find(x => x.name.toLowerCase() === name);
    return header ? header.value || header.binaryValue || '' : '';
};

export const DEFAULT_ARIA2_OPTIONS = {
    host: "localhost",
    protocol: "http",
    port: 6800,
    secure: false,
    path: "/jsonrpc",
    secret: ""
};

export const readAria2Options = async () => {
    const result = await browser.storage.local.get({ aria2_options: DEFAULT_ARIA2_OPTIONS });
    return result.aria2_options;
};

const getFilenameFromURL = (url) => {
    url = url.split(/[?#]/, 1)[0];
    const match = url.match(/([^/]+)[/ ]*$/);
    let filename = match ? match[1] : "download";
    try {
        filename = decodeURIComponent(filename);
    } catch (e) {/* URIError */ }
    return filename;
};

export const getFilename = (details) => {
    let filename = "";
    const contentDisp = getHeaderVal(details.responseHeaders, "content-disposition");
    if (contentDisp !== undefined && contentDisp !== "") {
        filename = getFilenameFromContentDispositionHeader(contentDisp);
    }
    if (!filename) {
        filename = getFilenameFromURL(details.url);
    }
    return sanitizeFilename(filename);
};
