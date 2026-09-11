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

export const MAX_RECENT_DIRS = 5;

export const DEFAULT_PROFILE = {
    id: "default",
    name: "Default",
    host: "localhost",
    protocol: "http",
    port: 6800,
    secure: false,
    path: "/jsonrpc",
    secret: "",
    dir: "",
    recentDirs: []
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
        for (const profile of data.profiles) {
            if (!Array.isArray(profile.recentDirs)) {
                profile.recentDirs = [];
            }
        }
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
            name: "Default",
            recentDirs: []
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

export async function addRecentDir(profileId, dir) {
    if (!dir || typeof dir !== "string") return [];
    const trimmed = dir.trim();
    if (!trimmed) return [];

    const config = await readProfilesConfig();
    const profile = config.profiles.find(p => p.id === profileId);
    if (!profile) return [];

    const existing = Array.isArray(profile.recentDirs) ? profile.recentDirs : [];
    profile.recentDirs = [trimmed, ...existing.filter(d => d !== trimmed)].slice(0, MAX_RECENT_DIRS);

    await saveProfilesConfig(config);
    return profile.recentDirs;
}

export async function clearRecentDirs(profileId) {
    const config = await readProfilesConfig();
    const profile = config.profiles.find(p => p.id === profileId);
    if (!profile) return [];

    profile.recentDirs = [];
    await saveProfilesConfig(config);
    return profile.recentDirs;
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

export function extractHostname(url) {
    if (!url || typeof url !== "string") return "";
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return "";
    }
}

export function generateRuleId() {
    return "rule_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
}

export async function readRoutingRules() {
    const data = await browser.storage.local.get({ routing_rules: [] });
    const rules = Array.isArray(data.routing_rules) ? data.routing_rules : [];
    const now = Date.now();

    const activeRules = rules.filter(rule => {
        if (typeof rule.expiresAt === "number" && now > rule.expiresAt) {
            return false;
        }
        return true;
    });

    if (activeRules.length !== rules.length) {
        await saveRoutingRules(activeRules);
    }

    return activeRules;
}

export async function saveRoutingRules(rules) {
    await browser.storage.local.set({ routing_rules: rules });
}

export async function addRoutingRule({ pattern, isRegex = false, action = "firefox", duration = "permanent", profileId = "", dir = "" }) {
    if (!pattern || typeof pattern !== "string") return null;
    const trimmedPattern = pattern.trim();
    if (!trimmedPattern) return null;

    if (isRegex) {
        try {
            new RegExp(trimmedPattern);
        } catch {
            throw new Error(`Invalid regular expression: ${trimmedPattern}`);
        }
    }

    const rules = await readRoutingRules();
    const now = Date.now();
    let expiresAt = null;

    if (duration === "session") {
        expiresAt = "session";
    } else if (typeof duration === "number" && duration > 0) {
        expiresAt = now + duration * 60 * 1000;
    } else if (duration === "15") {
        expiresAt = now + 15 * 60 * 1000;
    } else if (duration === "60") {
        expiresAt = now + 60 * 60 * 1000;
    }

    const newRule = {
        id: generateRuleId(),
        pattern: trimmedPattern,
        isRegex: Boolean(isRegex),
        action,
        duration: String(duration),
        expiresAt,
        profileId,
        dir,
        createdAt: now
    };

    const updatedRules = [
        newRule,
        ...rules.filter(r => !(r.pattern.toLowerCase() === trimmedPattern.toLowerCase() && Boolean(r.isRegex) === Boolean(isRegex)))
    ];

    await saveRoutingRules(updatedRules);
    return newRule;
}

export async function removeRoutingRule(ruleId) {
    const rules = await readRoutingRules();
    const filtered = rules.filter(r => r.id !== ruleId);
    await saveRoutingRules(filtered);
    return filtered;
}

export async function clearSessionRoutingRules() {
    const data = await browser.storage.local.get({ routing_rules: [] });
    const rules = Array.isArray(data.routing_rules) ? data.routing_rules : [];
    const nonSession = rules.filter(r => r.expiresAt !== "session");
    if (nonSession.length !== rules.length) {
        await saveRoutingRules(nonSession);
    }
    return nonSession;
}


export function matchRoutingRule(rules, pageUrl, downloadUrl) {
    if (!Array.isArray(rules) || rules.length === 0) return null;
    const now = Date.now();
    const pageHost = extractHostname(pageUrl);
    const dlHost = extractHostname(downloadUrl);

    for (const rule of rules) {
        if (typeof rule.expiresAt === "number" && now > rule.expiresAt) {
            continue;
        }

        if (rule.isRegex) {
            try {
                const reg = new RegExp(rule.pattern, "i");
                const testUrl = (u) => {
                    if (!u) return false;
                    if (reg.test(u)) return true;
                    const clean = u.split(/[?#]/, 1)[0];
                    return clean !== u && reg.test(clean);
                };

                if (testUrl(downloadUrl) || testUrl(pageUrl)) {
                    return rule;
                }
            } catch (e) {
                console.warn("YAAI: Invalid regex in rule:", rule.pattern, e);
            }
            continue;
        }

        const pat = rule.pattern.toLowerCase();
        const matches = (host) => {
            if (!host) return false;
            return host === pat || host.endsWith("." + pat);
        };

        if (matches(pageHost) || matches(dlHost)) {
            return rule;
        }
    }
    return null;
}

