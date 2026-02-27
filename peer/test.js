// test.js
const Peer = require('./peer');
const Directory = require('./directory');
const { generateKeys } = require('./crypto');

async function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function main() {
    const directory = new Directory('http://localhost:8080');

    const aliceKeys = generateKeys();
    const bobKeys = generateKeys();

    const alice = new Peer({
        username: 'alice',
        address: '127.0.0.1:9001',
        port: 9001,
        keys: aliceKeys,
        directory
    });

    const bob = new Peer({
        username: 'bob',
        address: '127.0.0.1:9002',
        port: 9002,
        keys: bobKeys,
        directory
    });

    alice.on('message', msg => {
        console.log(`[Alice] <- ${msg.from}: ${msg.text}`);
    });

    bob.on('message', msg => {
        console.log(`[Bob] <- ${msg.from}: ${msg.text}`);
    });

    // Start servers
    alice.startServer();
    bob.startServer();

    // Register peers
    await sleep(300);
    await alice.registerHeartbeat();
    await bob.registerHeartbeat();

    // Let directory propagate
    await sleep(300);

    console.log('[Test] Connecting Alice -> Bob...');
    await alice.connectToUsername('bob');

    await sleep(300);

    console.log('[Test] Sending messages...');
    await alice.sendMessage('bob', 'Hello Bob 👋');
    await bob.sendMessage('alice', 'Hello Alice 👋');

    await sleep(1000);
    console.log('[Test] Done.');
}

main().catch(err => console.error(err));