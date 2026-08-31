import { describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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
  test('arrow keys move the selection, carry focus, and wrap at the ends', async () => {
    const { user } = renderPanel();

    tab(/^Chat/).focus();
    await user.keyboard('{ArrowLeft}');
    expect(tab(/Participants/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Participants/)).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(tab(/^Chat/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/^Chat/)).toHaveFocus();

    /** Past the last tab, selection wraps rather than stopping. */
    await user.keyboard('{ArrowRight}');
    expect(tab(/Participants/)).toHaveAttribute('aria-selected', 'true');
  });

  test('Tab reaches the leave control, then only the selected tab', async () => {
    const { onLeave, user } = renderPanel();

    expect(tab(/^Chat/)).toHaveAttribute('tabindex', '0');
    expect(tab(/Participants/)).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Leave session' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onLeave).toHaveBeenCalled();

    await user.tab();
    expect(tab(/^Chat/)).toHaveFocus();
  });

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

  test('initials stand in for an avatar and are hidden from assistive technology', async () => {
    const { user } = renderPanel();
    await user.click(tab(/Participants/));

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('AF');
    expect(rows[1]).toHaveTextContent('BF');

    /** They only repeat the name beside them, so they are decorative. */
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

describe('live regions', () => {
  const typingLine = () => screen.getByRole('status', { name: 'Typing status' });

  test('the typing line names one, both, or several people, and is empty for none', () => {
    const cases: [string[], string][] = [
      [[], ''],
      [['Bea Nolan'], 'Bea is typing…'],
      [['Bea Nolan', 'Cal Reed'], 'Bea and Cal are typing…'],
      [['Bea Nolan', 'Cal Reed', 'Dee Shah'], 'Several people are typing…'],
    ];

    for (const [names, expected] of cases) {
      renderPanel({ typingNames: names });
      expect(typingLine()).toHaveTextContent(expected);
      /** First names only, to match the messages beside it. */
      expect(typingLine()).not.toHaveTextContent('Nolan');
      cleanup();
    }
  });

  test('connection changes are announced, not only shown', () => {
    const status = () => screen.getByRole('status', { name: 'Connection status' });

    renderPanel({ status: 'reconnecting' });
    expect(status()).toHaveTextContent('Reconnecting to the chat server');
    cleanup();

    renderPanel();
    expect(status()).toHaveTextContent('Connected. You can send messages.');
  });
});
