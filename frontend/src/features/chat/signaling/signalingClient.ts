import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  DescriptionSignal,
  IceCandidateSignal,
  Participant,
  RoomJoinRequest,
  ServerToClientEvents,
} from '../../../../../shared/signalingEvents';

/** Health of the transport, as the client sees it. */
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'failed';

/**
 * The server only ever answers invalid-payload. no-response is added here for the
 * case where the server never replies at all.
 */
export type JoinOutcome =
  | { ok: true; participants: Participant[] }
  | { ok: false; reason: 'invalid-payload' | 'no-response' };

type Unsubscribe = () => void;

export type SignalingClient = {
  join(request: RoomJoinRequest): Promise<JoinOutcome>;
  sendOffer(signal: DescriptionSignal): void;
  sendAnswer(signal: DescriptionSignal): void;
  sendIceCandidate(signal: IceCandidateSignal): void;
  onParticipantJoined(handler: (participant: Participant) => void): Unsubscribe;
  onParticipantLeft(handler: (participantId: string) => void): Unsubscribe;
  onOffer(handler: (signal: DescriptionSignal) => void): Unsubscribe;
  onAnswer(handler: (signal: DescriptionSignal) => void): Unsubscribe;
  onIceCandidate(handler: (signal: IceCandidateSignal) => void): Unsubscribe;
  onConnectionChange(handler: (state: ConnectionState) => void): Unsubscribe;
  onRejoin(handler: (outcome: JoinOutcome) => void): Unsubscribe;
  close(): void;
};

const JOIN_TIMEOUT_MS = 10_000;

type SignalingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Wraps the Socket.IO client so nothing else in the app touches it.
 * Carries signaling only, never a chat message.
 */
export function createSignalingClient(url: string): SignalingClient {
  const socket: SignalingSocket = io(url, { autoConnect: true });

  let lastRequest: RoomJoinRequest | null = null;
  let hasJoinedOnce = false;
  let hasConnectedOnce = false;
  const connectionHandlers = new Set<(state: ConnectionState) => void>();
  const rejoinHandlers = new Set<(outcome: JoinOutcome) => void>();

  let connectionState: ConnectionState = 'connecting';

  const announce = (state: ConnectionState): void => {
    connectionState = state;

    for (const handler of connectionHandlers) {
      handler(state);
    }
  };

  function emitJoin(request: RoomJoinRequest): Promise<JoinOutcome> {
    return new Promise((resolve) => {
      socket.timeout(JOIN_TIMEOUT_MS).emit('room:join', request, (error, result) => {
        resolve(error ? { ok: false, reason: 'no-response' } : result);
      });
    });
  }

  /** Socket.IO reconnects on its own; the room has to be rejoined by hand. */
  socket.on('connect', () => {
    hasConnectedOnce = true;
    announce('connected');
    if (hasJoinedOnce && lastRequest !== null) {
      const request = lastRequest;
      void emitJoin(request).then((outcome) => {
        for (const handler of rejoinHandlers) {
          handler(outcome);
        }
      });
    }
  });

  socket.on('disconnect', () => {
    announce(socket.active ? 'reconnecting' : 'failed');
  });

  /**
   * Socket.IO keeps retrying, so socket.active alone would report reconnecting
   * even on the very first attempt. Never having connected is a failure to reach
   * the server, not a lost connection.
   */
  socket.on('connect_error', () => {
    announce(hasConnectedOnce && socket.active ? 'reconnecting' : 'failed');
  });

  return {
    async join(request) {
      lastRequest = request;

      const outcome = await emitJoin(request);
      hasJoinedOnce = outcome.ok;

      return outcome;
    },
    sendOffer: (signal) => {
      socket.emit('webrtc:offer', signal);
    },
    sendAnswer: (signal) => {
      socket.emit('webrtc:answer', signal);
    },
    sendIceCandidate: (signal) => {
      socket.emit('webrtc:ice-candidate', signal);
    },
    onParticipantJoined: (handler) => {
      socket.on('participant:joined', handler);
      return () => {
        socket.off('participant:joined', handler);
      };
    },
    onParticipantLeft: (handler) => {
      const listener = (payload: { participantId: string }): void => {
        handler(payload.participantId);
      };
      socket.on('participant:left', listener);
      return () => {
        socket.off('participant:left', listener);
      };
    },
    onOffer: (handler) => {
      socket.on('webrtc:offer', handler);
      return () => {
        socket.off('webrtc:offer', handler);
      };
    },
    onAnswer: (handler) => {
      socket.on('webrtc:answer', handler);
      return () => {
        socket.off('webrtc:answer', handler);
      };
    },
    onIceCandidate: (handler) => {
      socket.on('webrtc:ice-candidate', handler);
      return () => {
        socket.off('webrtc:ice-candidate', handler);
      };
    },
    onConnectionChange: (handler) => {
      connectionHandlers.add(handler);
      handler(connectionState);

      return () => {
        connectionHandlers.delete(handler);
      };
    },
    onRejoin: (handler) => {
      rejoinHandlers.add(handler);

      return () => {
        rejoinHandlers.delete(handler);
      };
    },
    close: () => {
      connectionHandlers.clear();
      rejoinHandlers.clear();
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
