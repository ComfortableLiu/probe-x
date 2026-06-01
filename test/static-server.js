/**
 * Probe-X Frontend Static Server (for E2E testing)
 *
 * Features:
 * - publicPath '/assets/' mapping
 * - /api/* proxy to backend (localhost:8101)
 * - SPA fallback for all other routes
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist', 'apps', 'frontend');
const PORT = 8000;
const API_BACKEND = { host: 'localhost', port: 8101 };

const mimes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function serveFile(fp, res) {
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    fp = path.join(DIST, 'index.html');
  }
  const ext = path.extname(fp);
  res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
}

/**
 * Proxy /api/* requests to the backend API server
 */
function proxyToBackend(req, res) {
  const options = {
    hostname: API_BACKEND.host,
    port: API_BACKEND.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${API_BACKEND.host}:${API_BACKEND.port}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Add CORS headers for browser requests
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy Error] ${req.method} ${req.url}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: -1, message: `Backend unreachable: ${err.message}` }));
  });

  req.pipe(proxyReq);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  // /api/* -> proxy to backend
  if (urlPath.startsWith('/api/') || urlPath === '/api') {
    return proxyToBackend(req, res);
  }

  // /assets/css/xxx -> css/xxx
  // /assets/js/xxx  -> js/xxx
  // /assets/xxx     -> assets/xxx (images, icons)
  if (urlPath.startsWith('/assets/')) {
    const sub = urlPath.slice('/assets/'.length);
    let fp = path.join(DIST, sub);
    if (!fs.existsSync(fp)) {
      fp = path.join(DIST, 'assets', sub);
    }
    serveFile(fp, res);
    return;
  }

  // SPA fallback: serve index.html for all other routes
  serveFile(path.join(DIST, urlPath), res);
}).listen(PORT, () => {
  console.log(`[E2E] Static server on http://localhost:${PORT}`);
  console.log(`[E2E] API proxy: /api/* -> http://${API_BACKEND.host}:${API_BACKEND.port}`);
  console.log(`[E2E] Serving from: ${DIST}`);
});
