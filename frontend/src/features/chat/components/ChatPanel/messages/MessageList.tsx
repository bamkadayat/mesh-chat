import { useLayoutEffect, useRef } from 'react';
import type { TimelineItem } from '../../../model/types';
import { MessageItem } from './MessageItem';
import { SystemEventItem } from './SystemEventItem';
import styles from './MessageList.module.css';

/** Close enough to the bottom to keep following new messages. */
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
  const follow = useRef(true);
  const lastTop = useRef(0);

  /** Pin before paint, so arriving messages never show a half-scrolled frame. */
  useLayoutEffect(() => {
    const region = scrollRef.current;
    if (region !== null && follow.current) {
      region.scrollTop = region.scrollHeight;
      lastTop.current = region.scrollTop;
    }
  }, [timeline]);

  /**
   * Treat only upward scrolling as the reader choosing history.
   * Auto-pinning and new messages should never mark them as scrolled away.
   */
  function handleScroll(): void {
    const region = scrollRef.current;
    if (region === null) {
      return;
    }

    const movedUp = region.scrollTop < lastTop.current;
    lastTop.current = region.scrollTop;

    const distance = region.scrollHeight - region.scrollTop - region.clientHeight;
    if (movedUp || distance <= NEAR_BOTTOM_PX) {
      follow.current = distance <= NEAR_BOTTOM_PX;
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
