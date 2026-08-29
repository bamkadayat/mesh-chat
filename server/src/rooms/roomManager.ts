import type { Participant } from '../../../shared/signalingEvents';

type Member = Participant & { socketId: string };

export type RoomManager = {
  listParticipants(roomId: string): Participant[];
  addParticipant(roomId: string, member: Member): void;
  removeBySocketId(socketId: string): { roomId: string; participantId: string } | null;
  findTargetSocketId(senderSocketId: string, targetParticipantId: string): string | null;
  roomCount(): number;
};

/**
 * In-memory rooms. Knows nothing about Socket.IO events, so it can be tested on its
 * own, and it never sees message content.
 */
export function createRoomManager(): RoomManager {
  const rooms = new Map<string, Map<string, Member>>();
  const locations = new Map<string, { roomId: string; participantId: string }>();

  function listParticipants(roomId: string): Participant[] {
    const members = rooms.get(roomId);
    if (members === undefined) {
      return [];
    }
    return [...members.values()].map(({ participantId, displayName }) => ({
      participantId,
      displayName,
    }));
  }

  /** A reconnecting tab keeps its participant ID, so the old socket entry is replaced. */
  function addParticipant(roomId: string, member: Member): void {
    const members = rooms.get(roomId) ?? new Map<string, Member>();
    rooms.set(roomId, members);

    const previous = members.get(member.participantId);
    if (previous !== undefined) {
      locations.delete(previous.socketId);
    }

    members.set(member.participantId, member);
    locations.set(member.socketId, { roomId, participantId: member.participantId });
  }

  function removeBySocketId(
    socketId: string,
  ): { roomId: string; participantId: string } | null {
    const location = locations.get(socketId);
    if (location === undefined) {
      return null;
    }

    locations.delete(socketId);
    const members = rooms.get(location.roomId);
    members?.delete(location.participantId);

    if (members?.size === 0) {
      rooms.delete(location.roomId);
    }

    return location;
  }

  /** Returns null when the target is in another room, so signals cannot cross rooms. */
  function findTargetSocketId(
    senderSocketId: string,
    targetParticipantId: string,
  ): string | null {
    const sender = locations.get(senderSocketId);
    if (sender === undefined) {
      return null;
    }
    return rooms.get(sender.roomId)?.get(targetParticipantId)?.socketId ?? null;
  }

  return {
    listParticipants,
    addParticipant,
    removeBySocketId,
    findTargetSocketId,
    roomCount: () => rooms.size,
  };
}
