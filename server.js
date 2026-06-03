const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
    // Basic routing to support the Vanilla JS SPA
    let filePath = '.' + req.url.split('?')[0].split('#')[0];
    
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // For SPA: if file not found, serve index.html
                fs.readFile('./index.html', (err, html) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(html, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}).listen(PORT, () => {
    console.log(`\n🚀 NCC Digital Training Platform is running!`);
    console.log(`👉 http://localhost:${PORT}\n`);
    console.log(`(Press CTRL+C to stop)`);
});
