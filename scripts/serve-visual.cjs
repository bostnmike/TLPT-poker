// Local packaged-site server; no Python/OS package installation in browser CI.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../.site-release');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.woff2':'font/woff2', '.woff':'font/woff', '.webp':'image/webp'};
const server = http.createServer((req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch {res.writeHead(400); res.end();}
});
server.listen(8775, '127.0.0.1');
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {server.closeAllConnections(); server.close();});
