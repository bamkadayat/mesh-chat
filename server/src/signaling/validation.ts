import {
  ROOM_ID,
  type DescriptionSignal,
  type IceCandidateSignal,
  type RoomJoinRequest,
} from '../../../shared/signalingEvents';

/** Everything here guards data sent by a browser, so it all starts from unknown. */
export function isJoinRequest(value: unknown): value is RoomJoinRequest {
  return (
    isRecord(value) &&
    value.roomId === ROOM_ID &&
    isNonEmptyString(value.participantId) &&
    isNonEmptyString(value.displayName)
  );
}

export function isDescriptionSignal(value: unknown): value is DescriptionSignal {
  if (!hasRoute(value) || !isRecord(value.description)) {
    return false;
  }
  const { type } = value.description;
  return type === 'offer' || type === 'answer';
}

export function isIceCandidateSignal(value: unknown): value is IceCandidateSignal {
  return hasRoute(value) && isRecord(value.candidate);
}

/** Both signal kinds carry the same sender and target pair. */
function hasRoute(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    isNonEmptyString(value.fromParticipantId) &&
    isNonEmptyString(value.toParticipantId)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
