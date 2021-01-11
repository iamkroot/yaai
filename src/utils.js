import { getFilenameFromContentDispositionHeader } from "./content-disposition.js";

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

const getFilenameFromURL = (url) => {
    url = url.split(/[?#]/, 1)[0];
    var filename = url.match(/([^/]+)[/ ]*$/)[1];
    try {
        filename = decodeURIComponent(filename);
    } catch (e) {/* URIError */ }
    return filename;
}


const illegalRe = /[\/\?<>\\:\*\|"]/g;
const controlRe = /[\x00-\x1f\x80-\x9f]/g;
const reservedRe = /^\.+$/;
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const windowsTrailingRe = /[\. ]+$/;

/**
 * Remove illegal chars from filename.
 * Taken from https://github.com/parshap/node-sanitize-filename/blob/209c39b914c8eb48ee27bcbde64b2c7822fdf3de/index.js
 * @param {String} filename Original filename
 * @param {char} replacement Replacement character
 */
const sanitizeFilename = (filename, replacement = "_") => {
    let sanitized = filename
        .replace(illegalRe, replacement)
        .replace(controlRe, replacement)
        .replace(reservedRe, replacement)
        .replace(windowsReservedRe, replacement)
        .replace(windowsTrailingRe, replacement);
    return sanitized;
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
