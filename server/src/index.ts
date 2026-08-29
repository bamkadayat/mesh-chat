import { createServer } from 'node:http';

const DEFAULT_PORT = 3001;
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const clientOrigin = process.env.CLIENT_ORIGIN ?? DEFAULT_CLIENT_ORIGIN;

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer, received "${process.env.PORT ?? ''}"`);
}

// The signaling server exposes no HTTP surface of its own. Socket.IO attaches to this
// server in a later step; until then every request answers 404 so a misconfigured
// client fails loudly instead of hanging.
const server = createServer((_request, response) => {
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(port, () => {
  console.log(`Signaling server listening on http://localhost:${port}`);
  console.log(`Accepting browser clients from ${clientOrigin}`);
});
