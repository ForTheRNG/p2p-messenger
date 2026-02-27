// handshake.js
const crypto = require('crypto');
const { sign, verify, encryptWithRSA, decryptWithRSA } = require('./crypto');

function generateSessionKey() {
    return crypto.randomBytes(32); // AES-256
}

function generateNonce() {
    return crypto.randomBytes(16);
}

/**
 * Create JSON handshake message
 */
function createHandshakeMessage(myPrivateKey, peerPublicKey, sessionKey) {
    const nonce = generateNonce();

    const payload = Buffer.concat([sessionKey, nonce]);
    const signature = sign(myPrivateKey, payload);

    const encryptedSessionKey = encryptWithRSA(peerPublicKey, sessionKey);

    return JSON.stringify({
        encryptedSessionKey: encryptedSessionKey.toString('base64'),
        nonce: nonce.toString('base64'),
        signature: signature.toString('base64')
    });
}

/**
 * Verify JSON handshake message
 */
function verifyHandshakeMessage(myPrivateKey, senderPublicKey, rawData) {
    const msg = JSON.parse(rawData.toString('utf8'));

    const encryptedSessionKey = Buffer.from(msg.encryptedSessionKey, 'base64');
    const nonce = Buffer.from(msg.nonce, 'base64');
    const signature = Buffer.from(msg.signature, 'base64');

    const sessionKey = decryptWithRSA(myPrivateKey, encryptedSessionKey);
    const payload = Buffer.concat([sessionKey, nonce]);

    if (!verify(senderPublicKey, payload, signature)) {
        throw new Error('Invalid handshake signature');
    }

    return sessionKey;
}

module.exports = {
    generateSessionKey,
    generateNonce,
    createHandshakeMessage,
    verifyHandshakeMessage
};