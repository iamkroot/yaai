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

export const DEFAULT_PROFILE = {
    id: "default",
    name: "Default",
    host: "localhost",
    protocol: "http",
    port: 6800,
    secure: false,
    path: "/jsonrpc",
    secret: "",
    dir: ""
};

export const DEFAULT_CONFIG = {
    profiles: [DEFAULT_PROFILE],
    activeProfileId: "default"
};

export function generateProfileId() {
    return "profile_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
}

export async function readProfilesConfig() {
    const data = await browser.storage.local.get(["profiles", "active_profile_id", "aria2_options"]);

    if (Array.isArray(data.profiles) && data.profiles.length > 0) {
        const activeProfileId = data.profiles.some(p => p.id === data.active_profile_id)
            ? data.active_profile_id
            : data.profiles[0].id;
        return { profiles: data.profiles, activeProfileId };
    }

    if (data.aria2_options) {
        const migratedProfile = {
            ...DEFAULT_PROFILE,
            ...data.aria2_options,
            id: "default",
            name: "Default"
        };
        const config = { profiles: [migratedProfile], activeProfileId: "default" };
        await saveProfilesConfig(config);
        return config;
    }

    return { profiles: [{ ...DEFAULT_PROFILE }], activeProfileId: "default" };
}

export async function saveProfilesConfig(config) {
    await browser.storage.local.set({
        profiles: config.profiles,
        active_profile_id: config.activeProfileId
    });
}

export function getActiveProfile(profiles, activeProfileId) {
    if (!profiles || profiles.length === 0) return { ...DEFAULT_PROFILE };
    return profiles.find(p => p.id === activeProfileId) || profiles[0];
}

export const DEFAULT_ARIA2_OPTIONS = DEFAULT_PROFILE;

export const readAria2Options = async () => {
    const config = await readProfilesConfig();
    return getActiveProfile(config.profiles, config.activeProfileId);
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
