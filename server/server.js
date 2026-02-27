// server.js
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

/** @type {Map<string, {username: string, publicKey: string, address: string, token: string, lastSeen: number}>} */
const peers = new Map(); // publicKey -> peer info

// Token derivation from public key
function makeToken(publicKey) {
    return crypto.createHash('sha256').update(publicKey).digest('hex');
}

// Track last lookup for rate-limiting
const lastQuery = new Map();

// Heartbeat timeout
const HEARTBEAT_TIMEOUT = 90_000; // 90 seconds

// -------------------- REGISTER / HEARTBEAT --------------------
app.post('/register', (req, res) => {
    const { username, publicKey, address } = req.body;
    // in /register handler
    console.log('[Directory] Register:', { username, publicKey: publicKey.slice(37, 57) + '...', address });
    const ip = req.socket.remoteAddress;
    const [addr, portStr] = address.split(':');
    const token = makeToken(publicKey);

    peers.set(publicKey, {
        username,
        publicKey,
        address: `${addr}:${portStr}`,
        token,
        lastSeen: Date.now() // update lastSeen on every heartbeat
    });

    res.json({ success: true });
});

// -------------------- PUBLIC PEER LIST (USERNAMES + PUBLIC KEYS ONLY) --------------------
app.get('/peers', (req, res) => {
    const now = Date.now();
    const list = Array.from(peers.values())
        .filter(p => now - p.lastSeen <= HEARTBEAT_TIMEOUT) // ignore stale peers
        .map(p => ({
            username: p.username,
            publicKey: p.publicKey
        }));
    res.json(list);
});

// -------------------- TOKEN-BASED LOOKUP --------------------
app.get('/lookup/:token', (req, res) => {
    const token = req.params.token;
    const now = Date.now();

    // Rate limit: 1 request per 5 seconds per token
    if (lastQuery.has(token) && now - lastQuery.get(token) < -1) {
        return res.status(429).json({ error: 'Too soon' });
    }
    lastQuery.set(token, now);

    const peer = Array.from(peers.values())
        .filter(p => now - p.lastSeen <= HEARTBEAT_TIMEOUT) // ignore stale peers
        .find(p => p.token === token);

    if (!peer) return res.status(404).json({ error: 'Peer not found or stale' });

    res.json({ username: peer.username, address: peer.address, publicKey: peer.publicKey });
});

// -------------------- PERIODIC CLEANUP --------------------
setInterval(() => {
    const now = Date.now();
    for (const [pubKey, peer] of peers.entries()) {
        if (now - peer.lastSeen > HEARTBEAT_TIMEOUT) {
            console.log(`[Directory] Removing stale peer: ${peer.username} (${peer.address})`);
            peers.delete(pubKey);
        }
    }
}, 60_000); // check every 60 seconds

// -------------------- START SERVER --------------------
app.listen(8080, () => console.log('[Directory] Listening on http://localhost:8080'));