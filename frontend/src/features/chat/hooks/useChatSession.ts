import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ROOM_ID,
  type Participant,
} from '../../../../../shared/signalingEvents';
import { createId } from '../../../lib/createId';
import { loadParticipantId } from '../model/identity';
import { chatReducer, initialChatState } from '../model/reducer';
import type {
  ComposerReadiness,
  SessionErrorReason,
  SessionStatus,
  SystemEvent,
  TimelineItem,
} from '../model/types';
import {
  parseChatEvent,
  serializeChatEvent,
  type ChatEvent,
} from '../protocol/protocol';
import { createPeerMesh, type ChannelState, type PeerMesh } from '../rtc/peerMesh';
import {
  createSignalingClient,
  type ConnectionState,
  type SignalingClient,
} from '../signaling/signalingClient';

export type ChatSession = {
  status: SessionStatus;
  errorReason: SessionErrorReason | null;
  participants: Participant[];
  timeline: TimelineItem[];
  readiness: ComposerReadiness;
  localParticipantId: string;
  join: (displayName: string) => Promise<void>;
  leave: () => void;
  /** Returns false when the protocol rejects the event, so the caller keeps the input. */
  sendMessage: (text: string) => boolean;
  editMessage: (messageId: string, text: string) => boolean;
  deleteMessage: (messageId: string) => boolean;
};

type ActiveSession = {
  signaling: SignalingClient;
  mesh: PeerMesh;
  unsubscribes: (() => void)[];
  identity: Participant;
};

export function useChatSession(signalingUrl: string): ChatSession {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [errorReason, setErrorReason] = useState<SessionErrorReason | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [channelStates, setChannelStates] = useState<Record<string, ChannelState>>({});
  const [chat, dispatch] = useReducer(chatReducer, initialChatState);

  const sessionRef = useRef<ActiveSession | null>(null);
  const [localParticipantId, setLocalParticipantId] = useState('');

  const addSystemEvent = useCallback((event: Omit<SystemEvent, 'eventId'>): void => {
    dispatch({ kind: 'system-event', event: { ...event, eventId: createId() } });
  }, []);

  const closeSession = useCallback((): void => {
    const session = sessionRef.current;
    sessionRef.current = null;

    if (session === null) {
      return;
    }

    for (const unsubscribe of session.unsubscribes) {
      unsubscribe();
    }
    session.mesh.close();
    session.signaling.close();
  }, []);

  /** Leaving a page must not leave sockets and peer connections behind. */
  useEffect(() => closeSession, [closeSession]);

  const join = useCallback(
    async (displayName: string): Promise<void> => {
      closeSession();
      setErrorReason(null);
      setStatus('connecting');

      const identity: Participant = {
        participantId: loadParticipantId(),
        displayName,
      };
      setLocalParticipantId(identity.participantId);

      const signaling = createSignalingClient(signalingUrl);

      const mesh = createPeerMesh({
        onMessage: ({ sourcePeerId, raw }) => {
          const event = parseChatEvent(raw);

          /** A peer may only speak for itself, whatever the payload claims. */
          if (event === null || event.payload.authorId !== sourcePeerId) {
            return;
          }
          dispatch({ kind: 'chat-event', event });
        },
        onChannelStateChange: (peerId, state) => {
          setChannelStates((current) => ({ ...current, [peerId]: state }));
        },
        onLocalDescription: (peerId, description) => {
          const signal = {
            fromParticipantId: identity.participantId,
            toParticipantId: peerId,
            description,
          };
          if (description.type === 'offer') {
            signaling.sendOffer(signal);
          } else {
            signaling.sendAnswer(signal);
          }
        },
        onLocalIceCandidate: (peerId, candidate) => {
          signaling.sendIceCandidate({
            fromParticipantId: identity.participantId,
            toParticipantId: peerId,
            candidate,
          });
        },
      });

      const unsubscribes = [
        signaling.onOffer(({ fromParticipantId, description }) => {
          void mesh.handleOffer(fromParticipantId, description);
        }),
        signaling.onAnswer(({ fromParticipantId, description }) => {
          void mesh.handleAnswer(fromParticipantId, description);
        }),
        signaling.onIceCandidate(({ fromParticipantId, candidate }) => {
          void mesh.handleIceCandidate(fromParticipantId, candidate);
        }),
        signaling.onParticipantJoined((participant) => {
          setParticipants((current) =>
            current.some((entry) => entry.participantId === participant.participantId)
              ? current
              : [...current, participant],
          );
          addSystemEvent({
            type: 'participant-joined',
            displayName: participant.displayName,
            occurredAt: new Date().toISOString(),
          });
        }),
        signaling.onParticipantLeft((participantId) => {
          setParticipants((current) => {
            const leaving = current.find((entry) => entry.participantId === participantId);
            if (leaving !== undefined) {
              addSystemEvent({
                type: 'participant-left',
                displayName: leaving.displayName,
                occurredAt: new Date().toISOString(),
              });
            }
            return current.filter((entry) => entry.participantId !== participantId);
          });
          setChannelStates((current) => {
            const next = { ...current };
            delete next[participantId];
            return next;
          });
          mesh.removePeer(participantId);
        }),
        signaling.onConnectionChange((state) => {
          if (state === 'failed') {
            setErrorReason('server-unreachable');
          }
          setStatus(toSessionStatus(state));
        }),
      ];

      sessionRef.current = { signaling, mesh, unsubscribes, identity };

      const outcome = await signaling.join({
        roomId: ROOM_ID,
        participantId: identity.participantId,
        displayName,
      });

      if (!outcome.ok) {
        closeSession();
        setErrorReason(outcome.reason === 'no-response' ? 'server-unreachable' : 'join-rejected');
        setStatus('error');
        return;
      }

      setParticipants([identity, ...outcome.participants]);
      setStatus('connected');

      /** Only the newcomer offers, which is what keeps two offers from crossing. */
      for (const existing of outcome.participants) {
        void mesh.connectToPeer(existing.participantId);
      }
    },
    [addSystemEvent, closeSession, signalingUrl],
  );

  const leave = useCallback((): void => {
    closeSession();
    setStatus('idle');
    setErrorReason(null);
    setParticipants([]);
    setChannelStates({});
  }, [closeSession]);

  /**
   * Sending and receiving take the same path: serialize, parse, dispatch. Local
   * state can then only hold what a peer would also accept.
   */
  const applyAndBroadcast = useCallback((event: ChatEvent): boolean => {
    const session = sessionRef.current;
    const accepted = parseChatEvent(serializeChatEvent(event));

    if (session === null || accepted === null) {
      return false;
    }

    dispatch({ kind: 'chat-event', event: accepted });
    session.mesh.broadcast(serializeChatEvent(accepted));
    return true;
  }, []);

  const sendMessage = useCallback(
    (text: string): boolean => {
      const identity = sessionRef.current?.identity;
      if (identity === undefined) {
        return false;
      }

      return applyAndBroadcast({
        type: 'message:create',
        payload: {
          messageId: createId(),
          authorId: identity.participantId,
          authorName: identity.displayName,
          text,
          createdAt: new Date().toISOString(),
        },
      });
    },
    [applyAndBroadcast],
  );

  const editMessage = useCallback(
    (messageId: string, text: string): boolean => {
      const identity = sessionRef.current?.identity;
      if (identity === undefined) {
        return false;
      }

      return applyAndBroadcast({
        type: 'message:update',
        payload: {
          messageId,
          authorId: identity.participantId,
          text,
          editedAt: new Date().toISOString(),
        },
      });
    },
    [applyAndBroadcast],
  );

  const deleteMessage = useCallback(
    (messageId: string): boolean => {
      const identity = sessionRef.current?.identity;
      if (identity === undefined) {
        return false;
      }

      return applyAndBroadcast({
        type: 'message:delete',
        payload: {
          messageId,
          authorId: identity.participantId,
          deletedAt: new Date().toISOString(),
        },
      });
    },
    [applyAndBroadcast],
  );

  const readiness = useMemo(
    (): ComposerReadiness => deriveReadiness(participants, localParticipantId, channelStates),
    [participants, localParticipantId, channelStates],
  );

  return {
    status,
    errorReason,
    participants,
    timeline: chat.timeline,
    readiness,
    localParticipantId,
    join,
    leave,
    sendMessage,
    editMessage,
    deleteMessage,
  };
}

/** The client reports transport health. The UI shows session status. */
function toSessionStatus(state: ConnectionState): SessionStatus {
  switch (state) {
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'reconnecting':
      return 'reconnecting';
    case 'failed':
      return 'error';
  }
}

/** Being in the room is not the same as being able to reach everyone in it. */
function deriveReadiness(
  participants: Participant[],
  localParticipantId: string,
  channelStates: Record<string, ChannelState>,
): ComposerReadiness {
  const remoteIds = participants
    .map((participant) => participant.participantId)
    .filter((participantId) => participantId !== localParticipantId);

  if (remoteIds.length === 0) {
    return 'waiting';
  }
  if (remoteIds.some((peerId) => channelStates[peerId] === 'failed')) {
    return 'failed';
  }
  if (remoteIds.every((peerId) => channelStates[peerId] === 'open')) {
    return 'open';
  }
  return 'connecting';
}
