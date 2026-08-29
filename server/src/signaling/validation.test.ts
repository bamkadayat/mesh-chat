import { describe, expect, it } from 'vitest';
import { isDescriptionSignal, isIceCandidateSignal, isJoinRequest } from './validation';
import { ROOM_ID } from '../../../shared/signalingEvents';

const join = { roomId: ROOM_ID, participantId: 'p1', displayName: 'Alex' };
const offer = {
  fromParticipantId: 'p1',
  toParticipantId: 'p2',
  description: { type: 'offer', sdp: 'v=0' },
};
const ice = {
  fromParticipantId: 'p1',
  toParticipantId: 'p2',
  candidate: { candidate: 'candidate:1 1 udp' },
};

/** Every guard must survive these without throwing. */
const NOT_OBJECTS = [null, undefined, 42, 'text', true, [], () => undefined];

describe('isJoinRequest', () => {
  it('accepts a well formed request', () => {
    expect(isJoinRequest(join)).toBe(true);
  });

  it('rejects another room', () => {
    expect(isJoinRequest({ ...join, roomId: 'somewhere-else' })).toBe(false);
  });

  it('rejects an empty or missing participant id', () => {
    expect(isJoinRequest({ ...join, participantId: '' })).toBe(false);
    expect(isJoinRequest({ roomId: ROOM_ID, displayName: 'Alex' })).toBe(false);
  });

  it('rejects an empty or missing display name', () => {
    expect(isJoinRequest({ ...join, displayName: '' })).toBe(false);
    expect(isJoinRequest({ roomId: ROOM_ID, participantId: 'p1' })).toBe(false);
  });

  it('rejects a field of the wrong type', () => {
    expect(isJoinRequest({ ...join, participantId: 42 })).toBe(false);
  });

  it('rejects anything that is not an object', () => {
    for (const value of NOT_OBJECTS) {
      expect(isJoinRequest(value)).toBe(false);
    }
  });
});

describe('isDescriptionSignal', () => {
  it('accepts an offer and an answer', () => {
    expect(isDescriptionSignal(offer)).toBe(true);
    expect(isDescriptionSignal({ ...offer, description: { type: 'answer' } })).toBe(true);
  });

  it('rejects a description type it does not know', () => {
    expect(isDescriptionSignal({ ...offer, description: { type: 'rollback' } })).toBe(false);
  });

  it('rejects a missing or non-object description', () => {
    expect(isDescriptionSignal({ fromParticipantId: 'p1', toParticipantId: 'p2' })).toBe(false);
    expect(isDescriptionSignal({ ...offer, description: 'offer' })).toBe(false);
  });

  it('rejects a missing sender or target', () => {
    expect(isDescriptionSignal({ ...offer, fromParticipantId: '' })).toBe(false);
    expect(isDescriptionSignal({ ...offer, toParticipantId: undefined })).toBe(false);
  });

  it('rejects anything that is not an object', () => {
    for (const value of NOT_OBJECTS) {
      expect(isDescriptionSignal(value)).toBe(false);
    }
  });
});

describe('isIceCandidateSignal', () => {
  it('accepts a well formed candidate', () => {
    expect(isIceCandidateSignal(ice)).toBe(true);
  });

  it('rejects a missing or non-object candidate', () => {
    expect(isIceCandidateSignal({ fromParticipantId: 'p1', toParticipantId: 'p2' })).toBe(false);
    expect(isIceCandidateSignal({ ...ice, candidate: 'candidate:1' })).toBe(false);
  });

  it('rejects a missing sender or target', () => {
    expect(isIceCandidateSignal({ ...ice, toParticipantId: '' })).toBe(false);
  });

  it('rejects anything that is not an object', () => {
    for (const value of NOT_OBJECTS) {
      expect(isIceCandidateSignal(value)).toBe(false);
    }
  });
});
