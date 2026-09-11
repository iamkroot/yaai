export class Aria2 {
    constructor(options = {}) {
        this.host = options.host || "localhost";
        this.port = options.port || 6800;
        this.secure = Boolean(options.secure);
        this.protocol = (options.protocol || "http").toLowerCase();
        this.path = options.path || "/jsonrpc";
        this.secret = options.secret || "";

        this.lastId = 0;
        this.socket = null;
        this.deferreds = new Map();
        this.connectingPromise = null;
    }

    get isWebSocket() {
        return this.protocol === "ws" || this.protocol === "wss";
    }

    get isSecure() {
        return this.secure || this.protocol === "https" || this.protocol === "wss";
    }

    getUrl(targetProtocol) {
        let scheme;
        if (targetProtocol) {
            scheme = targetProtocol;
        } else if (this.isWebSocket) {
            scheme = this.isSecure ? "wss" : "ws";
        } else {
            scheme = this.isSecure ? "https" : "http";
        }

        const normalizedPath = this.path.startsWith("/") ? this.path : `/${this.path}`;
        return `${scheme}://${this.host}:${this.port}${normalizedPath}`;
    }

    _buildMessage(method, params = []) {
        let prefixedMethod = method;
        if (!prefixedMethod.startsWith("aria2.") && !prefixedMethod.startsWith("system.")) {
            prefixedMethod = "aria2." + prefixedMethod;
        }

        const finalParams = [];
        if (this.secret) {
            finalParams.push(`token:${this.secret}`);
        }
        if (Array.isArray(params)) {
            finalParams.push(...params);
        } else if (params !== undefined) {
            finalParams.push(params);
        }

        const id = String(++this.lastId);
        return {
            jsonrpc: "2.0",
            id,
            method: prefixedMethod,
            params: finalParams
        };
    }

    async _sendHttp(message, timeoutMs = 30000) {
        const url = this.getUrl();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(message),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Aria2 HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                const err = new Error(data.error.message || "Aria2 RPC error");
                err.code = data.error.code;
                err.data = data.error.data;
                throw err;
            }

            return data.result;
        } finally {
            clearTimeout(timer);
        }
    }

    _getOrCreateWebSocket() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            return Promise.resolve(this.socket);
        }
        if (this.connectingPromise) {
            return this.connectingPromise;
        }

        this.connectingPromise = new Promise((resolve, reject) => {
            const wsUrl = this.getUrl();
            let socket;
            try {
                socket = new WebSocket(wsUrl);
            } catch (err) {
                this.connectingPromise = null;
                reject(err);
                return;
            }

            socket.onopen = () => {
                this.socket = socket;
                this.connectingPromise = null;
                resolve(socket);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.id !== undefined) {
                        const deferred = this.deferreds.get(String(data.id));
                        if (deferred) {
                            this.deferreds.delete(String(data.id));
                            if (deferred.timer) clearTimeout(deferred.timer);
                            if (data.error) {
                                const err = new Error(data.error.message || "Aria2 RPC error");
                                err.code = data.error.code;
                                err.data = data.error.data;
                                deferred.reject(err);
                            } else {
                                deferred.resolve(data.result);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Aria2 WebSocket parse error:", e);
                }
            };

            socket.onerror = () => {
                if (this.connectingPromise) {
                    this.connectingPromise = null;
                    reject(new Error(`Failed to connect to Aria2 WebSocket at ${wsUrl}`));
                }
            };

            socket.onclose = () => {
                if (this.socket === socket) {
                    this.socket = null;
                }
                this.connectingPromise = null;
                for (const [id, deferred] of this.deferreds) {
                    if (deferred.timer) clearTimeout(deferred.timer);
                    deferred.reject(new Error("Aria2 WebSocket connection closed"));
                }
                this.deferreds.clear();
            };
        });

        return this.connectingPromise;
    }

    async _sendWebSocket(message, timeoutMs = 30000) {
        const ws = await this._getOrCreateWebSocket();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.deferreds.delete(message.id);
                reject(new Error(`Aria2 WebSocket request ${message.id} timed out`));
            }, timeoutMs);

            this.deferreds.set(message.id, { resolve, reject, timer });

            try {
                ws.send(JSON.stringify(message));
            } catch (err) {
                clearTimeout(timer);
                this.deferreds.delete(message.id);
                reject(err);
            }
        });
    }

    async call(method, ...params) {
        const message = this._buildMessage(method, params);
        if (this.isWebSocket) {
            return await this._sendWebSocket(message);
        } else {
            return await this._sendHttp(message);
        }
    }

    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        for (const [id, deferred] of this.deferreds) {
            if (deferred.timer) clearTimeout(deferred.timer);
            deferred.reject(new Error("Aria2 client closed"));
        }
        this.deferreds.clear();
    }
}
