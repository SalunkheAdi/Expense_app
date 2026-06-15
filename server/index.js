import http from 'http';
import { URL } from 'url';

const PORT = process.env.PORT || 3001;

function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
  });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  if (parsedUrl.pathname === '/api/health') {
    return sendJSON(res, { status: 'ok' });
  }
  sendJSON(res, { error: 'Not Found' }, 404);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
