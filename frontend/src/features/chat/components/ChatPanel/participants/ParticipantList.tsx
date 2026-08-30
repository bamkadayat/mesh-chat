import type { Participant } from '../../../../../../../shared/signalingEvents';
import styles from './ParticipantList.module.css';

type ParticipantListProps = {
  participants: Participant[];
  connectingIds: string[];
};

export function ParticipantList({ participants, connectingIds }: ParticipantListProps) {
  return (
    <ul className={styles.list}>
      {participants.map((participant) => (
        <li key={participant.participantId} className={styles.item}>
          <span>{participant.displayName}</span>
          {connectingIds.includes(participant.participantId) && (
            <span className={styles.connecting}>Connecting…</span>
          )}
        </li>
      ))}
    </ul>
  );
}
