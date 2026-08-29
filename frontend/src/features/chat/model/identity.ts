import { createId } from '../../../lib/createId';

const PARTICIPANT_ID_KEY = 'mesh-chat.participant-id';

/**
 * Messages are owned by this ID, so the tab must keep the same one after a
 * reconnect. sessionStorage is per tab, so two tabs are two participants.
 */
export function loadParticipantId(): string {
  const stored = sessionStorage.getItem(PARTICIPANT_ID_KEY);

  if (stored !== null && stored !== '') {
    return stored;
  }

  const participantId = createId();
  sessionStorage.setItem(PARTICIPANT_ID_KEY, participantId);
  return participantId;
}
