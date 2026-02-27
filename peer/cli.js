// cli.js
const readline = require('readline');
const Peer = require('./peer');
const Directory = require('./directory');
const { setTransport, getTransport } = require('./transport');
const { generateKeys } = require('./crypto');
const path = require('path');
const fs = require('fs');

function loadOrCreateKeys(keyPath) {
    const dir = path.dirname(keyPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(keyPath)) {
        return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    }

    const keys = generateKeys();
    fs.writeFileSync(keyPath, JSON.stringify(keys, null, 2));
    console.log('[Keys] Generated new identity');
    return keys;
}

const username = process.env.USERNAME;
const hostname = process.env.HOSTNAME;
const port = Number(process.env.PORT);
const directoryUrl = process.env.DIRECTORY_URL || 'http://directory:8080';
const keyPath = process.env.KEY_PATH || `/data/keys/${username}.json`;

const keys = loadOrCreateKeys(keyPath);
const directory = new Directory(directoryUrl);

const peer = new Peer({
    username,
    address: `${hostname}:${port}`,
    port,
    keys,
    directory
});

peer.startServer();
setInterval(() => peer.registerHeartbeat(), 5000);

peer.on('message', ({ from, text }) => {
    console.log(`\n[${from}] ${text}`);
    rl.prompt();
});

// ---------------- CLI ----------------
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${username}> `
});

console.log(`[CLI] Ready. Type "help"`);
rl.prompt();

rl.on('line', async line => {
    const [cmd, ...args] = line.trim().split(' ');

    try {
        switch (cmd) {
            case 'help':
                console.log(`
Commands:
  peers                     List peers
  connect <username>        Connect to peer
  send <username> <msg>     Send message
  transport tcp|tor         Switch transport
  whoami                    Show identity
  exit                      Quit
                `.trim());
                break;

            case 'peers': {
                const peers = await directory.getAllPeers();
                for (const p of peers) {
                    console.log(`- ${p.username} (${p.publicKey.slice(27, 67)}...)`);
                }
                break;
            }

            case 'connect': {
                const name = args[0];
                if (!name) return console.log('Usage: connect <username>');
                await peer.connectToUsername(name);
                break;
            }

            case 'send': {
                const name = args.shift();
                const msg = args.join(' ');
                if (!name || !msg) return console.log('Usage: send <username> <message>');
                await peer.sendMessage(name, msg);
                break;
            }

            case 'transport': {
                const type = args[0];
                if (!['tcp', 'tor'].includes(type)) {
                    return console.log('Usage: transport tcp|tor');
                }
                setTransport(type);
                console.log(`[Transport] Switched to ${getTransport()}`);
                break;
            }

            case 'whoami': {
                console.log(`Username: ${username}`);
                console.log(`Public key hash: ${directory.hashPublicKey?.(keys.publicKey) || keys.publicKey.slice(0, 32)}`);
                console.log(`Transport: ${getTransport()}`);
                break;
            }

            case 'exit':
                process.exit(0);

            default:
                console.log(`Unknown command: ${cmd}`);
        }
    } catch (e) {
        console.error('[CLI Error]', e.message);
    }

    rl.prompt();
});