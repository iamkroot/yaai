import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_PROFILE,
    DEFAULT_CONFIG,
    generateProfileId,
    readProfilesConfig,
    saveProfilesConfig,
    getActiveProfile,
    readAria2Options,
    addRecentDir,
    clearRecentDirs,
    MAX_RECENT_DIRS,
    readRoutingRules,
    addRoutingRule,
    removeRoutingRule,
    clearSessionRoutingRules,
    matchRoutingRule,
    extractHostname
} from "../addon/common/utils.js";

// Mock browser.storage.local
let mockStorage = {};

globalThis.browser = {
    storage: {
        local: {
            get: async (keys) => {
                const result = {};
                if (Array.isArray(keys)) {
                    for (const key of keys) {
                        if (key in mockStorage) {
                            result[key] = mockStorage[key];
                        }
                    }
                } else if (typeof keys === "object") {
                    for (const [key, defaultVal] of Object.entries(keys)) {
                        result[key] = key in mockStorage ? mockStorage[key] : defaultVal;
                    }
                } else if (typeof keys === "string") {
                    if (keys in mockStorage) {
                        result[keys] = mockStorage[keys];
                    }
                }
                return result;
            },
            set: async (items) => {
                Object.assign(mockStorage, items);
            }
        }
    }
};

describe("Profiles Data Model & Storage", () => {
    beforeEach(() => {
        mockStorage = {};
    });

    it("returns default configuration on fresh install", async () => {
        const config = await readProfilesConfig();
        assert.equal(config.profiles.length, 1);
        assert.equal(config.profiles[0].id, "default");
        assert.equal(config.profiles[0].name, "Default");
        assert.equal(config.profiles[0].host, "localhost");
        assert.equal(config.profiles[0].port, 6800);
        assert.equal(config.activeProfileId, "default");
    });

    it("seamlessly migrates legacy aria2_options into a default profile", async () => {
        mockStorage = {
            aria2_options: {
                host: "192.168.1.100",
                port: 6801,
                protocol: "ws",
                secure: true,
                path: "/rpc",
                secret: "supersecret"
            }
        };

        const config = await readProfilesConfig();
        assert.equal(config.profiles.length, 1);
        assert.equal(config.profiles[0].id, "default");
        assert.equal(config.profiles[0].name, "Default");
        assert.equal(config.profiles[0].host, "192.168.1.100");
        assert.equal(config.profiles[0].port, 6801);
        assert.equal(config.profiles[0].protocol, "ws");
        assert.equal(config.profiles[0].secure, true);
        assert.equal(config.profiles[0].path, "/rpc");
        assert.equal(config.profiles[0].secret, "supersecret");
        assert.equal(config.activeProfileId, "default");

        // Verify it was saved to storage
        assert.deepEqual(mockStorage.profiles, config.profiles);
        assert.equal(mockStorage.active_profile_id, "default");
    });

    it("loads multiple configured profiles and respects activeProfileId", async () => {
        mockStorage = {
            profiles: [
                { id: "p1", name: "Local", host: "localhost", port: 6800 },
                { id: "p2", name: "NAS", host: "nas.local", port: 6800, dir: "/volume1/downloads" }
            ],
            active_profile_id: "p2"
        };

        const config = await readProfilesConfig();
        assert.equal(config.profiles.length, 2);
        assert.equal(config.activeProfileId, "p2");

        const active = getActiveProfile(config.profiles, config.activeProfileId);
        assert.equal(active.name, "NAS");
        assert.equal(active.dir, "/volume1/downloads");
    });

    it("falls back to first profile if activeProfileId does not match any profile", async () => {
        mockStorage = {
            profiles: [
                { id: "p1", name: "Local", host: "localhost", port: 6800 }
            ],
            active_profile_id: "non-existent"
        };

        const config = await readProfilesConfig();
        assert.equal(config.activeProfileId, "p1");
        const active = getActiveProfile(config.profiles, config.activeProfileId);
        assert.equal(active.id, "p1");
    });

    it("saves and retrieves updated profile configurations", async () => {
        const newId = generateProfileId();
        const config = {
            profiles: [
                { ...DEFAULT_PROFILE, id: "default", name: "Default" },
                { ...DEFAULT_PROFILE, id: newId, name: "Remote Seedbox", host: "seedbox.io", secret: "token" }
            ],
            activeProfileId: newId
        };

        await saveProfilesConfig(config);
        const retrieved = await readProfilesConfig();
        assert.equal(retrieved.profiles.length, 2);
        assert.equal(retrieved.activeProfileId, newId);
        assert.equal(getActiveProfile(retrieved.profiles, retrieved.activeProfileId).name, "Remote Seedbox");
    });

    it("maintains backward compatibility with readAria2Options", async () => {
        mockStorage = {
            profiles: [
                { ...DEFAULT_PROFILE, id: "default", name: "Default", host: "local.test" },
                { ...DEFAULT_PROFILE, id: "active", name: "Active", host: "active.test" }
            ],
            active_profile_id: "active"
        };

        const options = await readAria2Options();
        assert.equal(options.host, "active.test");
    });

    it("generateProfileId returns unique strings with prefix", () => {
        const id1 = generateProfileId();
        const id2 = generateProfileId();
        assert.match(id1, /^profile_/);
        assert.match(id2, /^profile_/);
        assert.notEqual(id1, id2);
    });

    it("getActiveProfile safely returns default if profiles array is empty or undefined", () => {
        const fallback1 = getActiveProfile([], "default");
        assert.equal(fallback1.id, "default");
        assert.equal(fallback1.host, "localhost");

        const fallback2 = getActiveProfile(null, "default");
        assert.equal(fallback2.id, "default");
    });

    it("addRecentDir adds directories in MRU order, deduplicates, and caps at MAX_RECENT_DIRS", async () => {
        mockStorage = {
            profiles: [
                { ...DEFAULT_PROFILE, id: "default", name: "Default", recentDirs: [] }
            ],
            active_profile_id: "default"
        };

        await addRecentDir("default", "/downloads/movies");
        await addRecentDir("default", "/downloads/music");
        await addRecentDir("default", "/downloads/books");

        let config = await readProfilesConfig();
        assert.deepEqual(config.profiles[0].recentDirs, [
            "/downloads/books",
            "/downloads/music",
            "/downloads/movies"
        ]);

        // Re-adding existing dir moves it to front without duplicating
        await addRecentDir("default", "/downloads/movies");
        config = await readProfilesConfig();
        assert.deepEqual(config.profiles[0].recentDirs, [
            "/downloads/movies",
            "/downloads/books",
            "/downloads/music"
        ]);

        // Adding more items caps at MAX_RECENT_DIRS (5)
        await addRecentDir("default", "/dir4");
        await addRecentDir("default", "/dir5");
        await addRecentDir("default", "/dir6");
        config = await readProfilesConfig();
        assert.equal(config.profiles[0].recentDirs.length, MAX_RECENT_DIRS);
        assert.equal(config.profiles[0].recentDirs[0], "/dir6");
        assert.equal(config.profiles[0].recentDirs.includes("/downloads/music"), false);
    });

    it("addRecentDir ignores empty or whitespace strings", async () => {
        mockStorage = {
            profiles: [
                { ...DEFAULT_PROFILE, id: "default", name: "Default", recentDirs: ["/dir1"] }
            ],
            active_profile_id: "default"
        };

        await addRecentDir("default", "");
        await addRecentDir("default", "   ");
        await addRecentDir("default", null);

        const config = await readProfilesConfig();
        assert.deepEqual(config.profiles[0].recentDirs, ["/dir1"]);
    });

    it("maintains recent directories separately per profile", async () => {
        mockStorage = {
            profiles: [
                { ...DEFAULT_PROFILE, id: "local", name: "Local", recentDirs: [] },
                { ...DEFAULT_PROFILE, id: "nas", name: "NAS", recentDirs: [] }
            ],
            active_profile_id: "local"
        };

        await addRecentDir("local", "/home/user/Downloads");
        await addRecentDir("nas", "/volume1/downloads");

        const config = await readProfilesConfig();
        const local = config.profiles.find(p => p.id === "local");
        const nas = config.profiles.find(p => p.id === "nas");

        assert.deepEqual(local.recentDirs, ["/home/user/Downloads"]);
        assert.deepEqual(nas.recentDirs, ["/volume1/downloads"]);
    });

    it("clearRecentDirs resets history for a profile", async () => {
        mockStorage = {
            profiles: [
                { ...DEFAULT_PROFILE, id: "default", name: "Default", recentDirs: ["/dir1", "/dir2"] }
            ],
            active_profile_id: "default"
        };

        await clearRecentDirs("default");
        const config = await readProfilesConfig();
        assert.deepEqual(config.profiles[0].recentDirs, []);
    });
});

describe("Routing Rules & Regex Matching", () => {
    beforeEach(() => {
        mockStorage = {};
    });

    it("extractHostname safely extracts lowercased hostnames", () => {
        assert.equal(extractHostname("https://GitHub.com/foo/bar"), "github.com");
        assert.equal(extractHostname("http://sub.domain.co.uk:8080/path?query=1"), "sub.domain.co.uk");
        assert.equal(extractHostname("invalid-url"), "");
        assert.equal(extractHostname(""), "");
    });

    it("addRoutingRule adds permanent, session, and time-based rules", async () => {
        const r1 = await addRoutingRule({
            pattern: "github.com",
            action: "firefox",
            duration: "permanent"
        });
        assert.equal(r1.pattern, "github.com");
        assert.equal(r1.action, "firefox");
        assert.equal(r1.expiresAt, null);

        const r2 = await addRoutingRule({
            pattern: "nexusmods.com",
            action: "aria2",
            duration: "15"
        });
        assert.equal(r2.pattern, "nexusmods.com");
        assert.equal(typeof r2.expiresAt, "number");
        assert.ok(r2.expiresAt > Date.now());

        const r3 = await addRoutingRule({
            pattern: "temp.site",
            action: "firefox",
            duration: "session"
        });
        assert.equal(r3.expiresAt, "session");

        const rules = await readRoutingRules();
        assert.equal(rules.length, 3);
    });

    it("addRoutingRule deduplicates by pattern and isRegex", async () => {
        await addRoutingRule({ pattern: "github.com", action: "firefox" });
        await addRoutingRule({ pattern: "github.com", action: "aria2" });

        const rules = await readRoutingRules();
        assert.equal(rules.length, 1);
        assert.equal(rules[0].action, "aria2");
    });

    it("addRoutingRule rejects invalid regex", async () => {
        await assert.rejects(
            async () => {
                await addRoutingRule({ pattern: "([invalid+", isRegex: true });
            },
            /Invalid regular expression/
        );
    });

    it("matchRoutingRule matches domains and subdomains", () => {
        const rules = [
            { id: "1", pattern: "github.com", isRegex: false, action: "firefox" }
        ];

        assert.ok(matchRoutingRule(rules, "https://github.com/releases", "https://s3.amazonaws.com/file.zip"));
        assert.ok(matchRoutingRule(rules, "https://sub.github.com/page", "https://sub.github.com/file.zip"));
        assert.ok(matchRoutingRule(rules, "https://other.com", "https://github.com/file.zip"));
        assert.equal(matchRoutingRule(rules, "https://notgithub.com", "https://example.com/file.zip"), null);
    });

    it("matchRoutingRule matches regex patterns against download and page URLs", () => {
        const rules = [
            { id: "1", pattern: "\\.(iso|tar\\.gz)$", isRegex: true, action: "aria2" },
            { id: "2", pattern: "drive\\.google\\.com/uc\\?", isRegex: true, action: "firefox" }
        ];

        // Matches download URL ending in .iso
        const m1 = matchRoutingRule(rules, "https://releases.ubuntu.com", "https://releases.ubuntu.com/ubuntu.iso");
        assert.equal(m1.action, "aria2");

        // Matches download URL with .tar.gz (case-insensitive)
        const m2 = matchRoutingRule(rules, "https://example.com", "https://example.com/ARCHIVE.TAR.GZ?dl=1");
        assert.equal(m2.action, "aria2");

        // Matches page URL
        const m3 = matchRoutingRule(rules, "https://drive.google.com/uc?id=123", "https://doc-04.googleusercontent.com/download");
        assert.equal(m3.action, "firefox");

        // Non-matching
        assert.equal(matchRoutingRule(rules, "https://example.com", "https://example.com/image.png"), null);
    });

    it("matchRoutingRule ignores expired rules", () => {
        const past = Date.now() - 1000;
        const rules = [
            { id: "1", pattern: "expired.com", isRegex: false, action: "aria2", expiresAt: past }
        ];

        assert.equal(matchRoutingRule(rules, "https://expired.com", "https://expired.com/dl"), null);
    });

    it("removeRoutingRule removes rules by id", async () => {
        const r1 = await addRoutingRule({ pattern: "site1.com", action: "firefox" });
        const r2 = await addRoutingRule({ pattern: "site2.com", action: "aria2" });

        let rules = await readRoutingRules();
        assert.equal(rules.length, 2);

        await removeRoutingRule(r1.id);
        rules = await readRoutingRules();
        assert.equal(rules.length, 1);
        assert.equal(rules[0].pattern, "site2.com");
    });

    it("clearSessionRoutingRules removes only session rules and keeps permanent ones", async () => {
        await addRoutingRule({ pattern: "perm.com", duration: "permanent", action: "aria2" });
        await addRoutingRule({ pattern: "session.com", duration: "session", action: "firefox" });

        let rules = await readRoutingRules();
        assert.equal(rules.length, 2);

        await clearSessionRoutingRules();
        rules = await readRoutingRules();
        assert.equal(rules.length, 1);
        assert.equal(rules[0].pattern, "perm.com");
    });
});

