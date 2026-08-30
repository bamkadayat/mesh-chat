import type { SystemEvent } from '../../model/types';
import { formatTime } from './formatTime';
import styles from './SystemEventItem.module.css';

const ACTION_TEXT: Record<SystemEvent['type'], string> = {
  'participant-joined': 'joined',
  'participant-left': 'left',
};

/** Built from presence, not from a chat message, so it is styled more quietly. */
export function SystemEventItem({ event }: { event: SystemEvent }) {
  return (
    <li className={styles.item}>
      <span className={styles.icon} aria-hidden="true">
        i
      </span>
      <span className={styles.text}>
        {event.displayName} {ACTION_TEXT[event.type]}
      </span>
      <time className={styles.time} dateTime={event.occurredAt}>
        {formatTime(event.occurredAt)}
      </time>
    </li>
  );
}
