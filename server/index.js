import http from 'http';
import { URL } from 'url';
import db from './db.js';

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
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/users' && req.method === 'GET') {
    const usersRes = await db.query('SELECT id, name, display_name FROM users ORDER BY display_name');
    return sendJSON(res, usersRes.rows);
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await getRequestBody(req);
    const { name, pin } = JSON.parse(body);
    const userRes = await db.query('SELECT * FROM users WHERE name = $1', [name.toLowerCase().trim()]);
    if (userRes.rowCount === 0) return sendJSON(res, { error: 'User not found' }, 404);
    const user = userRes.rows[0];
    if (user.pin !== pin) return sendJSON(res, { error: 'Incorrect PIN' }, 401);
    return sendJSON(res, { id: user.id, name: user.name, display_name: user.display_name });
  }

  sendJSON(res, { error: 'Not Found' }, 404);
});

db.initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// API Preview/Finalize routes stub