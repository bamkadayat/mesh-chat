import { useEffect, useRef } from 'react';
import type { TimelineItem } from '../../../model/types';
import { MessageItem } from './MessageItem';
import { SystemEventItem } from './SystemEventItem';
import styles from './MessageList.module.css';

/** Anything within this many pixels of the bottom counts as reading the latest. */
const NEAR_BOTTOM_PX = 48;

type MessageListProps = {
  timeline: TimelineItem[];
  localParticipantId: string;
  onEdit: (messageId: string, text: string) => boolean;
  onDelete: (messageId: string) => boolean;
};

export function MessageList({
  timeline,
  localParticipantId,
  onEdit,
  onDelete,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasNearBottom = useRef(true);

  /** Follow new messages only when the reader has not scrolled up to read history. */
  useEffect(() => {
    const region = scrollRef.current;
    if (region !== null && wasNearBottom.current) {
      region.scrollTop = region.scrollHeight;
    }
  }, [timeline]);

  function handleScroll(): void {
    const region = scrollRef.current;
    if (region !== null) {
      const distance = region.scrollHeight - region.scrollTop - region.clientHeight;
      wasNearBottom.current = distance <= NEAR_BOTTOM_PX;
    }
  }

  return (
    <div
      className={styles.scroll}
      ref={scrollRef}
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
      tabIndex={0}
      onScroll={handleScroll}
    >
      <ul className={styles.list}>
        {timeline.map((item) =>
          item.kind === 'message' ? (
            <MessageItem
              key={item.message.messageId}
              message={item.message}
              isOwn={item.message.authorId === localParticipantId}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : (
            <SystemEventItem key={item.event.eventId} event={item.event} />
          ),
        )}
      </ul>
    </div>
  );
}
