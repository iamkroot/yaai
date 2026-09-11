import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Aria2 } from "../addon/common/aria2.js";

describe("Aria2 Client Construction & Message Building", () => {
    it("generates correct HTTP URLs", () => {
        const client = new Aria2({
            host: "127.0.0.1",
            port: 6800,
            protocol: "http",
            path: "/jsonrpc"
        });
        assert.equal(client.getUrl(), "http://127.0.0.1:6800/jsonrpc");
    });

    it("generates correct WebSocket URLs", () => {
        const client = new Aria2({
            host: "aria.myserver.com",
            port: 8443,
            protocol: "wss",
            path: "rpc"
        });
        assert.equal(client.getUrl(), "wss://aria.myserver.com:8443/rpc");
    });

    it("builds JSON-RPC message with secret token and aria2 prefix", () => {
        const client = new Aria2({
            secret: "mytoken123"
        });
        const msg = client._buildMessage("addUri", [["http://example.com/file.zip"], { dir: "/tmp" }]);
        assert.equal(msg.jsonrpc, "2.0");
        assert.equal(msg.method, "aria2.addUri");
        assert.equal(msg.params[0], "token:mytoken123");
        assert.deepEqual(msg.params[1], ["http://example.com/file.zip"]);
        assert.deepEqual(msg.params[2], { dir: "/tmp" });
    });
});
