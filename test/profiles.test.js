import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_PROFILE,
    DEFAULT_CONFIG,
    generateProfileId,
    readProfilesConfig,
    saveProfilesConfig,
    getActiveProfile,
    readAria2Options
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
});
