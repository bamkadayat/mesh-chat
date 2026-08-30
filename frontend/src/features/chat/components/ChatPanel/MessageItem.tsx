import type { ChatMessage } from '../../model/types';
import { linkify } from '../../protocol/linkify';
import { formatTime } from './formatTime';
import styles from './MessageItem.module.css';

/** Text is split into tokens and rendered as real anchors, never as HTML. */
function MessageText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((token, index) =>
        token.kind === 'link' ? (
          <a
            key={index}
            className={styles.link}
            href={token.value}
            target="_blank"
            rel="noopener noreferrer"
          >
            {token.value}
          </a>
        ) : (
          <span key={index}>{token.value}</span>
        ),
      )}
    </>
  );
}

export function MessageItem({ message }: { message: ChatMessage }) {
  const isDeleted = message.deletedAt !== null;

  return (
    <li className={styles.item}>
      <p className={styles.header}>
        <span className={styles.author}>{message.authorName}</span>
        <time className={styles.time} dateTime={message.createdAt}>
          {formatTime(message.createdAt)}
        </time>
      </p>

      <p className={isDeleted ? styles.tombstone : styles.body}>
        {isDeleted ? (
          'Message deleted'
        ) : (
          <>
            <MessageText text={message.text} />
            {message.editedAt !== null && <span className={styles.edited}> (edited)</span>}
          </>
        )}
      </p>
    </li>
  );
}
