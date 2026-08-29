import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  DescriptionSignal,
  ServerToClientEvents,
} from '../../../shared/signalingEvents';
import type { RoomManager } from '../rooms/roomManager';
import { isDescriptionSignal, isIceCandidateSignal, isJoinRequest } from './validation';

type SignalingServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Wiring only. Room state lives in roomManager, payload checks in validation. */
export function registerSignalingHandlers(io: SignalingServer, rooms: RoomManager): void {
  io.on('connection', (socket) => {
    socket.on('room:join', (request, acknowledge) => {
      if (!isJoinRequest(request)) {
        acknowledge({ ok: false, reason: 'invalid-payload' });
        return;
      }

      const { roomId, participantId, displayName } = request;

      /** Read the roster before adding, so the joiner does not offer to itself. */
      const existing = rooms.listParticipants(roomId);
      rooms.addParticipant(roomId, { participantId, displayName, socketId: socket.id });
      void socket.join(roomId);

      acknowledge({ ok: true, participants: existing });
      socket.to(roomId).emit('participant:joined', { participantId, displayName });
    });

    socket.on('webrtc:offer', (signal) => {
      relayDescription(io, rooms, 'webrtc:offer', socket.id, signal);
    });

    socket.on('webrtc:answer', (signal) => {
      relayDescription(io, rooms, 'webrtc:answer', socket.id, signal);
    });

    socket.on('webrtc:ice-candidate', (signal) => {
      if (!isIceCandidateSignal(signal)) {
        return;
      }
      const target = rooms.findTargetSocketId(socket.id, signal.toParticipantId);
      if (target !== null) {
        io.to(target).emit('webrtc:ice-candidate', signal);
      }
    });

    socket.on('disconnect', () => {
      const left = rooms.removeBySocketId(socket.id);
      if (left !== null) {
        io.to(left.roomId).emit('participant:left', { participantId: left.participantId });
      }
    });
  });
}

/** findTargetSocketId returns null across rooms, so a signal cannot leave its room. */
function relayDescription(
  io: SignalingServer,
  rooms: RoomManager,
  event: 'webrtc:offer' | 'webrtc:answer',
  senderSocketId: string,
  signal: DescriptionSignal,
): void {
  if (!isDescriptionSignal(signal)) {
    return;
  }
  const target = rooms.findTargetSocketId(senderSocketId, signal.toParticipantId);
  if (target !== null) {
    io.to(target).emit(event, signal);
  }
}
