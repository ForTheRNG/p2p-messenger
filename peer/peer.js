// peer.js
const EventEmitter = require('events');
const { encryptWithSession, decryptWithSession } = require('./crypto');
const { createSocket } = require('./transport');
const { generateNonce, createHandshakeMessage, verifyHandshakeMessage, generateSessionKey } = require('./handshake');
const net = require('net');

class Peer extends EventEmitter {
    constructor({ username, address, port, keys, directory }) {
        super();
        this.username = username;
        this.address = address;
        this.port = port;
        this.keys = keys; // { publicKey, privateKey }
        this.directory = directory;

        /** @type {Map<string, net.Socket>} */
        this.sockets = new Map();

        /** @type {Map<string, Buffer>} AES session keys */
        this.sessions = new Map();
    }

    // -------------------- TCP/Tor Server --------------------
    startServer() {
        const server = net.createServer(socket => this.handleIncoming(socket));
        server.listen(this.port, () => {
            console.log(`[P2P] Listening on ${this.port}`);
        });
    }

    async handleIncoming(socket) {
        console.log('[P2P] Incoming connection');

        let sessionKey = null;
        let peerUsername = null;

        socket.once('data', async data => {
            try {
                const allPeers = await this.directory.getAllPeers();

                const msg = JSON.parse(data.toString('utf8'));

                // Try all known public keys until one verifies
                for (const peer of allPeers) {
                    try {
                        const full = await this.directory.lookup(peer.publicKey);
                        sessionKey = verifyHandshakeMessage(this.keys.privateKey, full.publicKey, data);
                        peerUsername = peer.username;
                        break;
                    } catch {}
                }

                if (!sessionKey) throw new Error('No valid sender public key found');

                this.sessions.set(peerUsername, sessionKey);
                this.sockets.set(peerUsername, socket);

                console.log(`[P2P] Handshake complete with ${peerUsername}`);

                socket.on('data', msgData => {
                    try {
                        const text = decryptWithSession(sessionKey, msgData);
                        this.emit('message', { from: peerUsername, text });
                    } catch (e) {
                        console.error('[P2P] Decrypt failed', e.message);
                    }
                });

            } catch (e) {
                console.error('[P2P] Handshake failed', e.message);
            }
        });
    }

    // -------------------- Connect to a peer --------------------
    async connectToUsername(peerUsername) {
        try {
            // Step 1: find peer public info
            const peerInfo = await this.directory.findByUsername(peerUsername);
            if (!peerInfo) throw new Error('Peer not found');

            // Step 2: fetch private info (address + publicKey)
            const fullInfo = await this.directory.lookup(peerInfo.publicKey);
            if (!fullInfo || !fullInfo.address) throw new Error('Peer address not found');

            const [host, portStr] = fullInfo.address.split(':');
            const port = Number(portStr);

            if (this.sockets.has(peerUsername)) return true; // already connected

            const socket = await createSocket(host, port);
            this.sockets.set(peerUsername, socket);

            // Step 3: generate ephemeral AES key and handshake
            const sessionKey = generateSessionKey();
            const nonce = generateNonce();
            this.sessions.set(peerUsername, sessionKey);

            const handshakeMsg = createHandshakeMessage(
                this.keys.privateKey,
                fullInfo.publicKey,
                sessionKey
            );

            socket.write(handshakeMsg);

            // Listen for peer messages
            socket.on('data', data => {
                try {
                    const text = decryptWithSession(sessionKey, data);
                    this.emit('message', { from: peerUsername, text });
                } catch (e) {
                    console.error('[P2P] Decrypt failed', e.message);
                }
            });

            socket.on('close', () => {
                this.sockets.delete(peerUsername);
                this.sessions.delete(peerUsername);
                console.log(`[P2P] Connection to ${peerUsername} closed`);
            });

            console.log(`[P2P] Connected to ${peerUsername} at ${fullInfo.address}`);
            return true;
        } catch (e) {
            console.error('[P2P] Connect failed', e.message);
            return false;
        }
    }

    // -------------------- Send a message --------------------
    async sendMessage(peerUsername, text) {
        const socket = this.sockets.get(peerUsername);
        const sessionKey = this.sessions.get(peerUsername);

        if (!socket || !sessionKey) {
            console.error('[P2P] Peer not connected or handshake incomplete');
            return;
        }

        const encrypted = encryptWithSession(sessionKey, text);
        socket.write(encrypted);
    }

    // -------------------- Heartbeat --------------------
    async registerHeartbeat() {
        await this.directory.register(this.username, this.keys.publicKey, this.address);
    }
}

module.exports = Peer;