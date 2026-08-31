import { useState } from 'react';
import type { Participant } from '../../../../../../shared/signalingEvents';
import type { ComposerReadiness, SessionStatus, TimelineItem } from '../../model/types';
import { connectionAnnouncement } from './connectionAnnouncement';
import { firstName } from './messages/firstName';
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
  typingNames: string[];
  localParticipantId: string;
  onSend: (text: string) => boolean;
  onTyping: (isTyping: boolean) => void;
  onEdit: (messageId: string, text: string) => boolean;
  onDelete: (messageId: string) => boolean;
  onLeave: () => void;
};

/**
 * Empty while nobody is typing, so the live region stays quiet. First names, to
 * match the messages beside it rather than the participant list.
 */
function typingLine(displayNames: string[]): string {
  const names = displayNames.map(firstName);

  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return `${String(names[0])} is typing…`;
  }
  if (names.length === 2) {
    return `${String(names[0])} and ${String(names[1])} are typing…`;
  }
  return 'Several people are typing…';
}

export function ChatPanel({
  status,
  participants,
  connectingIds,
  timeline,
  readiness,
  typingNames,
  localParticipantId,
  onSend,
  onTyping,
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
   * Count messages received while the participants tab is open.
   * Deleted messages still count because they stay as tombstones.
   */
  const unread = tabs.tab === 'chat' ? 0 : messageCount - seenCount;

  /** Reading the chat marks everything in it as seen, including later arrivals. */
  if (tabs.tab === 'chat' && seenCount !== messageCount) {
    setSeenCount(messageCount);
  }

  /**
   * main, not section: this is the page content once you have joined. The label
   * points at the heading instead of repeating the title as a second string.
   */
  return (
    <main className={styles.panel} aria-labelledby="chat-title">
      <header className={styles.header}>
        <h1 id="chat-title" className={styles.title}>
          Status meeting standup
        </h1>
        <button type="button" className={styles.close} onClick={onLeave} aria-label="Leave session">
          ✕
        </button>
      </header>

      <div className={styles.body}>
        <ChatTabs tabs={tabs} participantCount={participants.length} unread={unread} />

        {status === 'reconnecting' && (
          <p className={styles.banner} aria-hidden="true">
            <svg className={styles.spinner} viewBox="0 0 16 16">
              <circle
                className={styles.spinnerTrack}
                cx="8"
                cy="8"
                r="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                className={styles.spinnerArc}
                cx="8"
                cy="8"
                r="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            Reconnecting to the chat server
          </p>
        )}

        {/* One region that stays mounted, so a screen reader reads each change
            instead of only what happens to be present when it first appears. */}
        <p className="visually-hidden" role="status" aria-label="Connection status">
          {connectionAnnouncement(status, readiness)}
        </p>

        <div
          className={styles.content}
          role="tabpanel"
          id="panel-participants"
          aria-labelledby="tab-participants"
          hidden={tabs.tab !== 'participants'}
          tabIndex={0}
        >
          <ParticipantList
            participants={participants}
            connectingIds={connectingIds}
            localParticipantId={localParticipantId}
          />
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
            isVisible={tabs.tab === 'chat'}
            localParticipantId={localParticipantId}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <p className={styles.typing} role="status" aria-label="Typing status">
            {typingLine(typingNames)}
          </p>
          <MessageComposer readiness={readiness} onSend={onSend} onTyping={onTyping} />
        </div>
      </div>
    </main>
  );
}
