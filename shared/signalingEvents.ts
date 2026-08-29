/** The one demo room. Both sides need it, so it lives here rather than in the client. */
export const ROOM_ID = 'status-meeting';

export type Participant = {
  participantId: string;
  displayName: string;
};

/**
 * Written by hand instead of using the DOM's RTCSessionDescriptionInit.
 * The server compiles without DOM types, and it only ever passes this along.
 */
export type SessionDescription = {
  type: 'offer' | 'answer';
  sdp?: string;
};

/** Hand-written for the same reason as SessionDescription. */
export type IceCandidate = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export type RoomJoinRequest = {
  roomId: string;
  participantId: string;
  displayName: string;
};

/** Sent back through the join callback, so a client cannot miss it by listening late. */
export type RoomJoinResult =
  | { ok: true; participants: Participant[] }
  | { ok: false; reason: 'invalid-payload' };

/** An offer or an answer on its way from one participant to another. */
export type DescriptionSignal = {
  fromParticipantId: string;
  toParticipantId: string;
  description: SessionDescription;
};

/** One ICE candidate on its way from one participant to another. */
export type IceCandidateSignal = {
  fromParticipantId: string;
  toParticipantId: string;
  candidate: IceCandidate;
};

export type ClientToServerEvents = {
  'room:join': (
    request: RoomJoinRequest,
    acknowledge: (result: RoomJoinResult) => void,
  ) => void;
  'webrtc:offer': (signal: DescriptionSignal) => void;
  'webrtc:answer': (signal: DescriptionSignal) => void;
  'webrtc:ice-candidate': (signal: IceCandidateSignal) => void;
};

export type ServerToClientEvents = {
  'participant:joined': (participant: Participant) => void;
  'participant:left': (payload: { participantId: string }) => void;
  'webrtc:offer': (signal: DescriptionSignal) => void;
  'webrtc:answer': (signal: DescriptionSignal) => void;
  'webrtc:ice-candidate': (signal: IceCandidateSignal) => void;
};
