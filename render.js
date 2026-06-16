const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}).listen(PORT, () => {
    console.log(`Health check server on port ${PORT}`);
});

require('./index.js');
