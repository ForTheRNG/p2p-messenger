const crypto = require('crypto');
const KEY_LEN = 2048;

// -------------------- Key generation --------------------
function generateKeys() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: KEY_LEN,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
}

// -------------------- AES session --------------------
function encryptWithSession(aesKey, plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]);
}

function decryptWithSession(aesKey, data) {
    const iv = data.slice(0, 16);
    const authTag = data.slice(16, 32);
    const ciphertext = data.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// -------------------- RSA encryption for handshake --------------------
function encryptWithRSA(peerPublicKey, data) {
    return crypto.publicEncrypt(peerPublicKey, data);
}

function decryptWithRSA(privateKey, data) {
    return crypto.privateDecrypt(privateKey, data);
}

// -------------------- Sign & Verify --------------------
function sign(privateKey, message) {
    const signer = crypto.createSign('sha256');
    signer.update(message);
    signer.end();
    return signer.sign(privateKey);
}

function verify(publicKey, message, signature) {
    const verifier = crypto.createVerify('sha256');
    verifier.update(message);
    verifier.end();
    return verifier.verify(publicKey, signature);
}

// -------------------- Public key hashing --------------------
function hashPublicKey(pubKey) {
    return crypto.createHash('sha256').update(pubKey).digest('hex');
}

module.exports = {
    generateKeys,
    encryptWithSession,
    decryptWithSession,
    encryptWithRSA,
    decryptWithRSA,
    sign,
    verify,
    hashPublicKey
};