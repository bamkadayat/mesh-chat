import type { Participant } from '../../../../../../../shared/signalingEvents';
import styles from './ParticipantList.module.css';

type ParticipantListProps = {
  participants: Participant[];
  connectingIds: string[];
  localParticipantId: string;
};

/**
 * First letter of the first and last word, so "Bam Kadayat" reads BK. A
 * one-word name gives one letter rather than a padded pair.
 */
function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function ParticipantList({
  participants,
  connectingIds,
  localParticipantId,
}: ParticipantListProps) {
  return (
    <ul className={styles.list}>
      {participants.map((participant) => (
        <li key={participant.participantId} className={styles.item}>
          <span className={styles.person}>
            {/* Decorative: the initials only repeat the name beside them. */}
            <span className={styles.avatar} aria-hidden="true">
              {initials(participant.displayName)}
            </span>
            <span>
              {participant.displayName}
              {participant.participantId === localParticipantId && (
                <span className={styles.you}> (You)</span>
              )}
            </span>
          </span>

          {connectingIds.includes(participant.participantId) && (
            <span className={styles.connecting}>Connecting…</span>
          )}
        </li>
      ))}
    </ul>
  );
}
