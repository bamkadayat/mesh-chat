import { useState } from 'react';
import type { Participant } from '../../../../../../shared/signalingEvents';
import type { ComposerReadiness, SessionStatus, TimelineItem } from '../../model/types';
import { MessageComposer } from './composer/MessageComposer';
import { MessageList } from './messages/MessageList';
import { ParticipantList } from './participants/ParticipantList';
import { ChatTabs } from './tabs/ChatTabs';
import { useChatPanelTabs } from './tabs/useChatPanelTabs';
import styles from './ChatPanel.module.css';

type ChatPanelProps = {
  status: SessionStatus;
  participants: Participant[];
  connectingIds: string[];
  timeline: TimelineItem[];
  readiness: ComposerReadiness;
  localParticipantId: string;
  onSend: (text: string) => boolean;
  onEdit: (messageId: string, text: string) => boolean;
  onDelete: (messageId: string) => boolean;
  onLeave: () => void;
};

export function ChatPanel({
  status,
  participants,
  connectingIds,
  timeline,
  readiness,
  localParticipantId,
  onSend,
  onEdit,
  onDelete,
  onLeave,
}: ChatPanelProps) {
  const tabs = useChatPanelTabs();
  const [seenCount, setSeenCount] = useState(0);

  const messageCount = timeline.reduce(
    (total, item) => total + (item.kind === 'message' ? 1 : 0),
    0,
  );

  /**
   * Messages that arrived while the participant list was open. Deleted messages
   * stay in the timeline as tombstones, so this count never runs backwards.
   */
  const unread = tabs.tab === 'chat' ? 0 : messageCount - seenCount;

  /** Reading the chat marks everything in it as seen, including later arrivals. */
  if (tabs.tab === 'chat' && seenCount !== messageCount) {
    setSeenCount(messageCount);
  }

  return (
    <section className={styles.panel} aria-label="Status meeting standup">
      <header className={styles.header}>
        <h1 className={styles.title}>Status meeting standup</h1>
        <button type="button" className={styles.close} onClick={onLeave} aria-label="Leave session">
          ✕
        </button>
      </header>

      <div className={styles.body}>
        <ChatTabs tabs={tabs} participantCount={participants.length} unread={unread} />

        {status === 'reconnecting' && (
          <p className={`${styles.status} ${styles.statusError}`} role="status">
            Reconnecting to the chat server…
          </p>
        )}

        <div
          className={styles.content}
          role="tabpanel"
          id="panel-participants"
          aria-labelledby="tab-participants"
          hidden={tabs.tab !== 'participants'}
          tabIndex={0}
        >
          <ParticipantList participants={participants} connectingIds={connectingIds} />
        </div>

        <div
          className={styles.content}
          role="tabpanel"
          id="panel-chat"
          aria-labelledby="tab-chat"
          hidden={tabs.tab !== 'chat'}
          tabIndex={0}
        >
          <MessageList
            timeline={timeline}
            localParticipantId={localParticipantId}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <MessageComposer readiness={readiness} onSend={onSend} />
        </div>
      </div>
    </section>
  );
}
