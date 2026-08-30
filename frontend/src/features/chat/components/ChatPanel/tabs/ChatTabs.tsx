import { TABS, type ChatPanelTabs } from './useChatPanelTabs';
import styles from './ChatTabs.module.css';

type ChatTabsProps = {
  tabs: ChatPanelTabs;
  participantCount: number;
  unread: number;
};

export function ChatTabs({ tabs, participantCount, unread }: ChatTabsProps) {
  const { tab, select, registerTab, handleTabKeys } = tabs;

  return (
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
          ref={registerTab(name)}
          className={tab === name ? styles.tabActive : styles.tab}
          onClick={() => {
            select(name);
          }}
          onKeyDown={handleTabKeys}
        >
          {name === 'participants' ? `Participants (${participantCount})` : 'Chat'}
          {name === 'chat' && unread > 0 && (
            <span className={styles.badge}>
              {unread}
              <span className="visually-hidden"> unread</span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
