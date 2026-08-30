import { useRef, useState, type KeyboardEvent } from 'react';
import type { Participant } from '../../../../../../shared/signalingEvents';
import type { ComposerReadiness, SessionStatus, TimelineItem } from '../../model/types';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';
import { ParticipantList } from './ParticipantList';
import styles from './ChatPanel.module.css';

type Tab = 'participants' | 'chat';
const TABS: Tab[] = ['participants', 'chat'];

type ChatPanelProps = {
  status: SessionStatus;
  participants: Participant[];
  connectingIds: string[];
  timeline: TimelineItem[];
  readiness: ComposerReadiness;
  onSend: (text: string) => boolean;
  onLeave: () => void;
};

export function ChatPanel({
  status,
  participants,
  connectingIds,
  timeline,
  readiness,
  onSend,
  onLeave,
}: ChatPanelProps) {
  const [tab, setTab] = useState<Tab>('chat');
  const [seenCount, setSeenCount] = useState(0);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    participants: null,
    chat: null,
  });

  const messageCount = timeline.reduce(
    (total, item) => total + (item.kind === 'message' ? 1 : 0),
    0,
  );

  /**
   * Messages that arrived while the participant list was open. Deleted messages
   * stay in the timeline as tombstones, so this count never runs backwards.
   */
  const unread = tab === 'chat' ? 0 : messageCount - seenCount;

  /** Reading the chat marks everything in it as seen, including later arrivals. */
  if (tab === 'chat' && seenCount !== messageCount) {
    setSeenCount(messageCount);
  }

  /** Arrow keys move between tabs, which is what the tab role promises. */
  function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length] ?? 'chat';
    setTab(next);
    tabRefs.current[next]?.focus();
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
        <div className={styles.tabs} role="tablist" aria-label="Panel sections">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tab-${name}`}
              aria-selected={tab === name}
              aria-controls={`panel-${name}`}
              tabIndex={tab === name ? 0 : -1}
              ref={(element) => {
                tabRefs.current[name] = element;
              }}
              className={tab === name ? styles.tabActive : styles.tab}
              onClick={() => {
                setTab(name);
              }}
              onKeyDown={handleTabKeys}
            >
              {name === 'participants' ? `Participants (${participants.length})` : 'Chat'}
              {name === 'chat' && unread > 0 && (
                <span className={styles.badge}>
                  {unread}
                  <span className="visually-hidden"> unread</span>
                </span>
              )}
            </button>
          ))}
        </div>

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
          hidden={tab !== 'participants'}
          tabIndex={0}
        >
          <ParticipantList participants={participants} connectingIds={connectingIds} />
        </div>

        <div
          className={styles.content}
          role="tabpanel"
          id="panel-chat"
          aria-labelledby="tab-chat"
          hidden={tab !== 'chat'}
          tabIndex={0}
        >
          <MessageList timeline={timeline} />
          <MessageComposer readiness={readiness} onSend={onSend} />
        </div>
      </div>
    </section>
  );
}
