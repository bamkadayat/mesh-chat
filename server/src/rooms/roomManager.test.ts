import { beforeEach, describe, expect, it } from 'vitest';
import { createRoomManager, type RoomManager } from './roomManager';

const ROOM = 'status-meeting';
const OTHER_ROOM = 'another-room';

let rooms: RoomManager;

beforeEach(() => {
  rooms = createRoomManager();
});

describe('roomManager membership', () => {
  it('starts with no rooms', () => {
    expect(rooms.roomCount()).toBe(0);
    expect(rooms.listParticipants(ROOM)).toEqual([]);
  });

  it('shows an added participant in the roster', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });

    expect(rooms.listParticipants(ROOM)).toEqual([
      { participantId: 'p1', displayName: 'Alex' },
    ]);
  });

  it('does not leak the socket id into the roster', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });

    expect(rooms.listParticipants(ROOM)[0]).not.toHaveProperty('socketId');
  });

  it('keeps several participants in one room', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.addParticipant(ROOM, { participantId: 'p2', displayName: 'Sam', socketId: 's2' });

    expect(rooms.listParticipants(ROOM)).toHaveLength(2);
  });
});

describe('roomManager reconnect', () => {
  it('replaces the connection of a rejoining participant instead of duplicating', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's2' });

    expect(rooms.listParticipants(ROOM)).toHaveLength(1);
  });

  it('routes to the new connection after a rejoin', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.addParticipant(ROOM, { participantId: 'p2', displayName: 'Sam', socketId: 's2' });
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's3' });

    expect(rooms.findTargetSocketId('s2', 'p1')).toBe('s3');
  });

  it('forgets the old connection after a rejoin', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's2' });

    expect(rooms.removeBySocketId('s1')).toBeNull();
  });
});

describe('roomManager removal', () => {
  it('removes a participant from the roster', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.addParticipant(ROOM, { participantId: 'p2', displayName: 'Sam', socketId: 's2' });

    expect(rooms.removeBySocketId('s1')).toEqual({ roomId: ROOM, participantId: 'p1' });
    expect(rooms.listParticipants(ROOM)).toEqual([
      { participantId: 'p2', displayName: 'Sam' },
    ]);
  });

  it('deletes a room once its last participant leaves', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.removeBySocketId('s1');

    expect(rooms.roomCount()).toBe(0);
  });

  it('returns null for an unknown socket', () => {
    expect(rooms.removeBySocketId('never-connected')).toBeNull();
  });
});

describe('roomManager sender identity', () => {
  it('reports which participant owns a socket', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });

    expect(rooms.findParticipantId('s1')).toBe('p1');
  });

  it('returns null for an unknown socket', () => {
    expect(rooms.findParticipantId('never-connected')).toBeNull();
  });

  it('follows the participant to a new socket after a rejoin', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's2' });

    expect(rooms.findParticipantId('s2')).toBe('p1');
    expect(rooms.findParticipantId('s1')).toBeNull();
  });

  it('forgets the socket once the participant leaves', () => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.removeBySocketId('s1');

    expect(rooms.findParticipantId('s1')).toBeNull();
  });
});

describe('roomManager signal routing', () => {
  beforeEach(() => {
    rooms.addParticipant(ROOM, { participantId: 'p1', displayName: 'Alex', socketId: 's1' });
    rooms.addParticipant(ROOM, { participantId: 'p2', displayName: 'Sam', socketId: 's2' });
    rooms.addParticipant(OTHER_ROOM, { participantId: 'p3', displayName: 'Kim', socketId: 's3' });
  });

  it('finds a target in the same room', () => {
    expect(rooms.findTargetSocketId('s1', 'p2')).toBe('s2');
  });

  it('does not find a target in another room', () => {
    expect(rooms.findTargetSocketId('s1', 'p3')).toBeNull();
  });

  it('does not route for an unknown sender', () => {
    expect(rooms.findTargetSocketId('unknown', 'p2')).toBeNull();
  });

  it('returns null for an unknown target', () => {
    expect(rooms.findTargetSocketId('s1', 'unknown')).toBeNull();
  });
});
