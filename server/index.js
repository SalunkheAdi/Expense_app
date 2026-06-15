import http from 'http';
const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SplitFlat HTTP Server is active\n');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
