import type { ComposerReadiness, SessionStatus } from '../../model/types';

/**
 * What a screen reader should hear when the connection changes. The visible
 * banner and the composer notice are separate; this is the spoken version.
 */
export function connectionAnnouncement(
  status: SessionStatus,
  readiness: ComposerReadiness,
): string {
  if (status === 'reconnecting') {
    return 'Reconnecting to the chat server.';
  }
  if (status === 'error') {
    return 'Disconnected from the chat server.';
  }

  switch (readiness) {
    case 'waiting':
      return 'Waiting for another participant.';
    case 'connecting':
      return 'Connecting to participants.';
    case 'failed':
      return 'Connection to a participant was lost.';
    case 'open':
      return 'Connected. You can send messages.';
  }
}
