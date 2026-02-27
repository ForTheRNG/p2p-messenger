const net = require('net');
const { SocksClient } = require('socks'); // Make sure 'socks' module is installed

/**
 * Expose current transport type setting
 * @type {'tcp'|'tor'}
 */
let currentTransport = 'tcp'; // default

/**
 * Create a transport socket based on type
 * @param {string} host
 * @param {number} port
 * @returns {Promise<net.Socket>} Connected socket
 */
async function createSocket(host, port) {
    if (currentTransport === 'tcp') {
        return new Promise((resolve, reject) => {
            const socket = net.connect(port, host, () => resolve(socket));
            socket.on('error', reject);
        });
    } else if (currentTransport === 'tor') {
        // Tor via SOCKS5 (default localhost:9050)
        const options = {
            proxy: { ipaddress: '127.0.0.1', port: 9050, type: 5 },
            command: 'connect',
            destination: { host, port }
        };
        const info = await SocksClient.createConnection(options);
        return info.socket; // net.Socket instance
    } else {
        throw new Error('Invalid transport type: ' + type);
    }
}


function setTransport(type) {
    if (!['tcp', 'tor'].includes(type)) throw new Error('Invalid transport type');
    currentTransport = type;
}

function getTransport() {
    return currentTransport;
}

module.exports = { createSocket, setTransport, getTransport };