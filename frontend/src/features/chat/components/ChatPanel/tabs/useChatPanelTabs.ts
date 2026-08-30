import { useRef, useState, type KeyboardEvent } from 'react';

export type Tab = 'participants' | 'chat';

export const TABS: Tab[] = ['participants', 'chat'];

export type ChatPanelTabs = {
  tab: Tab;
  select: (tab: Tab) => void;
  registerTab: (tab: Tab) => (element: HTMLButtonElement | null) => void;
  handleTabKeys: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

/** Owns which panel is showing and the roving focus the tab role promises. */
export function useChatPanelTabs(initial: Tab = 'chat'): ChatPanelTabs {
  const [tab, setTab] = useState<Tab>(initial);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    participants: null,
    chat: null,
  });

  /** Arrow keys move between tabs and carry focus with the selection. */
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

  return {
    tab,
    select: setTab,
    registerTab: (name) => (element) => {
      tabRefs.current[name] = element;
    },
    handleTabKeys,
  };
}
