const { hashPublicKey } = require('./crypto');

class Directory {
    /**
     * @param {string} baseUrl URL of the directory server, e.g., 'http://localhost:8080'
     */
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.lastPeers = [];
    }

    // -------------------- Register / heartbeat --------------------
    async register(username, publicKey, address) {
        try {
            const res = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, publicKey, address })
            });
            const data = await res.json();
            return data.success === true;
        } catch (e) {
            console.error('[Directory] Register failed:', e.message);
            return false;
        }
    }

    // -------------------- List all peers (public info) --------------------
    async getAllPeers() {
        try {
            const res = await fetch(`${this.baseUrl}/peers`);
            const peers = await res.json();
            this.lastPeers = peers;
            return peers;
        } catch (e) {
            console.error('[Directory] Fetch peers failed:', e.message);
            return this.lastPeers || [];
        }
    }

    // -------------------- Lookup peer by public key --------------------
    async lookup(publicKey) {
        try {
            const token = hashPublicKey(publicKey);
            const res = await fetch(`${this.baseUrl}/lookup/${token}`);
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return await res.json(); // { username, address, publicKey }
        } catch (e) {
            console.error('[Directory] Lookup failed:', e.message);
            return null;
        }
    }

    // -------------------- Helper: find peer by username --------------------
    async findByUsername(username) {
        const peers = await this.getAllPeers();
        return peers.find(p => p.username === username) || null;
    }
}

module.exports = Directory;