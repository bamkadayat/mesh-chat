import { beforeEach, describe, expect, it } from 'vitest';
import { loadParticipantId } from './identity';

const PARTICIPANT_ID_KEY = 'mesh-chat.participant-id';

describe('loadParticipantId', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns the ID already held in sessionStorage', () => {
    sessionStorage.setItem(PARTICIPANT_ID_KEY, 'existing-participant-id');

    expect(loadParticipantId()).toBe('existing-participant-id');
  });

  it('creates and stores an ID when none exists', () => {
    expect(sessionStorage.getItem(PARTICIPANT_ID_KEY)).toBeNull();

    const participantId = loadParticipantId();

    expect(participantId).not.toBe('');
    expect(sessionStorage.getItem(PARTICIPANT_ID_KEY)).toBe(participantId);
  });

  it('replaces an empty stored value rather than returning it', () => {
    sessionStorage.setItem(PARTICIPANT_ID_KEY, '');

    const participantId = loadParticipantId();

    expect(participantId).not.toBe('');
    expect(sessionStorage.getItem(PARTICIPANT_ID_KEY)).toBe(participantId);
  });
});
