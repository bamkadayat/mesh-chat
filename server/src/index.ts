import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/signalingEvents';
import { readServerConfig } from './config/env';
import { createRoomManager } from './rooms/roomManager';
import { registerSignalingHandlers } from './signaling/handlers';

const { port, clientOrigin } = readServerConfig(process.env);

/** Socket.IO answers its own path. Anything else is a 404 so a bad URL fails loudly. */
const httpServer = createServer((_request, response) => {
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: clientOrigin },
});

registerSignalingHandlers(io, createRoomManager());

httpServer.listen(port, () => {
  console.log(`Signaling server listening on http://localhost:${port}`);
  console.log(`Accepting browser clients from ${clientOrigin}`);
});
