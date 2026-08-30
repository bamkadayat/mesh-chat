import { describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Participant } from '../../../../../../shared/signalingEvents';
import type { SessionStatus, TimelineItem } from '../../model/types';
import { ChatPanel } from './ChatPanel';

const PARTICIPANTS: Participant[] = [
  { participantId: 'p-me', displayName: 'Alex Fisher' },
  { participantId: 'p-bea', displayName: 'Bea Fisher' },
];

function messageItem(messageId: string, text: string): TimelineItem {
  return {
    kind: 'message',
    message: {
      messageId,
      authorId: 'p-bea',
      authorName: 'Bea Fisher',
      text,
      createdAt: '2026-08-30T09:15:00.000Z',
      editedAt: null,
      deletedAt: null,
    },
  };
}

function renderPanel(
  overrides: {
    status?: SessionStatus;
    timeline?: TimelineItem[];
    connectingIds?: string[];
    typingNames?: string[];
  } = {},
) {
  const onLeave = vi.fn();
  const view = render(
    <ChatPanel
      status={overrides.status ?? 'connected'}
      participants={PARTICIPANTS}
      connectingIds={overrides.connectingIds ?? []}
      timeline={overrides.timeline ?? []}
      readiness="open"
      typingNames={overrides.typingNames ?? []}
      localParticipantId="p-me"
      onSend={() => true}
      onTyping={() => undefined}
      onEdit={() => true}
      onDelete={() => true}
      onLeave={onLeave}
    />,
  );
  return { onLeave, user: userEvent.setup(), rerender: view.rerender };
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('keyboard navigation', () => {
  test('arrow keys move selection and carry focus with it', async () => {
    const { user } = renderPanel();

    tab(/^Chat/).focus();
    await user.keyboard('{ArrowLeft}');
    expect(tab(/Participants/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Participants/)).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(tab(/^Chat/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/^Chat/)).toHaveFocus();
  });

  test('arrows wrap around rather than stopping at the ends', async () => {
    const { user } = renderPanel();

    tab(/^Chat/).focus();
    await user.keyboard('{ArrowRight}');

    expect(tab(/Participants/)).toHaveAttribute('aria-selected', 'true');
  });

  test('only the selected tab is reachable by Tab, as a tablist requires', () => {
    renderPanel();

    expect(tab(/^Chat/)).toHaveAttribute('tabindex', '0');
    expect(tab(/Participants/)).toHaveAttribute('tabindex', '-1');
  });

  test('the whole panel is operable from the keyboard alone', async () => {
    const { onLeave, user } = renderPanel();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Leave session' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onLeave).toHaveBeenCalled();

    await user.tab();
    expect(tab(/^Chat/)).toHaveFocus();
  });
});

describe('panels', () => {
  test('exactly one panel is visible at a time', async () => {
    const { user } = renderPanel();

    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-chat');

    await user.click(tab(/Participants/));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-participants');
  });
});

describe('presence', () => {
  test('you are marked in the list, and nobody else is', async () => {
    const { user } = renderPanel();
    await user.click(tab(/Participants/));

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Alex Fisher (You)');
    expect(rows[1]).toHaveTextContent('Bea Fisher');
    expect(rows[1]).not.toHaveTextContent('(You)');
  });

  test('each participant carries their initials', async () => {
    const { user } = renderPanel();
    await user.click(tab(/Participants/));

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('AF');
    expect(rows[1]).toHaveTextContent('BF');
  });

  test('the initials are hidden from assistive technology, being a repeat of the name', async () => {
    const { user } = renderPanel();
    await user.click(tab(/Participants/));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('AF')).toHaveAttribute('aria-hidden', 'true');
  });

  test('a participant whose channel is still opening is marked, and only that one', async () => {
    const { user } = renderPanel({ connectingIds: ['p-bea'] });
    await user.click(tab(/Participants/));

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Alex Fisher');
    expect(rows[0]).not.toHaveTextContent('Connecting');
    expect(rows[1]).toHaveTextContent('Bea Fisher');
    expect(rows[1]).toHaveTextContent('Connecting…');
  });

  test('nobody is marked once every channel is open', async () => {
    const { user } = renderPanel();
    await user.click(tab(/Participants/));

    expect(screen.queryByText('Connecting…')).toBeNull();
  });
});

describe('names', () => {
  test('the participant list shows full names and the chat shows first names', async () => {
    const { user } = renderPanel({ timeline: [messageItem('m-1', 'hello')] });

    /** Both panels stay mounted, so assert against the visible one only. */
    const chat = within(screen.getByRole('tabpanel'));
    expect(chat.getByText('Bea')).toBeInTheDocument();
    expect(chat.queryByText('Bea Fisher')).toBeNull();

    await user.click(tab(/Participants/));
    const people = within(screen.getByRole('tabpanel'));
    expect(people.getByText('Bea Fisher')).toBeInTheDocument();
    expect(people.queryByText('Bea')).toBeNull();
  });
});

describe('unread count', () => {
  test('messages arriving while the participant list is open are counted', async () => {
    const { user, rerender } = renderPanel();

    await user.click(tab(/Participants/));
    expect(tab(/^Chat/)).toHaveTextContent('Chat');

    rerender(
      <ChatPanel
        status="connected"
        participants={PARTICIPANTS}
        connectingIds={[]}
        timeline={[messageItem('m-1', 'one'), messageItem('m-2', 'two')]}
        readiness="open"
        typingNames={[]}
        localParticipantId="p-me"
        onSend={() => true}
        onTyping={() => undefined}
        onEdit={() => true}
        onDelete={() => true}
        onLeave={() => undefined}
      />,
    );

    expect(tab(/^Chat/)).toHaveTextContent('2 unread');

    await user.click(tab(/^Chat/));
    expect(tab(/^Chat/)).not.toHaveTextContent('unread');
  });
});

describe('typing indicator', () => {
  const typingLine = () => screen.getByRole('status', { name: 'Typing status' });

  test('nobody typing leaves the line empty, so nothing is announced', () => {
    renderPanel();

    expect(typingLine()).toHaveTextContent('');
  });

  test('one person is named, by first name like the messages beside it', () => {
    renderPanel({ typingNames: ['Bea Nolan'] });

    expect(typingLine()).toHaveTextContent('Bea is typing…');
    expect(typingLine()).not.toHaveTextContent('Nolan');
  });

  test('two people are both named', () => {
    renderPanel({ typingNames: ['Bea Nolan', 'Cal Reed'] });

    expect(typingLine()).toHaveTextContent('Bea and Cal are typing…');
  });

  test('more than two are summarised rather than listed', () => {
    renderPanel({ typingNames: ['Bea Nolan', 'Cal Reed', 'Dee Shah'] });

    expect(typingLine()).toHaveTextContent('Several people are typing…');
  });
});

describe('connection announcements', () => {
  test('a reconnect is announced, not only shown', () => {
    renderPanel({ status: 'reconnecting' });

    expect(screen.getByRole('status', { name: 'Connection status' })).toHaveTextContent(
      'Reconnecting to the chat server',
    );
  });

  test('a healthy session announces that sending is possible', () => {
    renderPanel();

    expect(screen.getByRole('status', { name: 'Connection status' })).toHaveTextContent(
      'Connected. You can send messages.',
    );
  });
});
