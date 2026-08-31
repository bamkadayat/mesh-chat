import { describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage } from '../../../model/types';
import { MessageItem } from './MessageItem';

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    messageId: 'm-1',
    authorId: 'p-alex',
    authorName: 'Alex',
    text: 'the original text',
    createdAt: '2026-08-30T09:15:00.000Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function renderItem(overrides: Partial<ChatMessage> = {}, isOwn = true) {
  const onEdit = vi.fn(() => true);
  const onDelete = vi.fn(() => true);
  render(
    <MessageItem message={message(overrides)} isOwn={isOwn} onEdit={onEdit} onDelete={onDelete} />,
  );
  return { onEdit, onDelete, user: userEvent.setup() };
}

const DELETED_AT = '2026-08-30T09:16:00.000Z';
const EDITED_AT = '2026-08-30T09:16:00.000Z';

describe('ownership', () => {
  test('the author gets edit and delete controls', () => {
    renderItem();

    expect(screen.getByRole('button', { name: /^Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete/ })).toBeInTheDocument();
  });

  test('another participant gets no controls', () => {
    renderItem({}, false);

    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });
});

describe('rendering', () => {
  test('your own message says You, another participant is named by first name', () => {
    renderItem({ authorName: 'Alex Fisher' }, true);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.queryByText('Alex')).toBeNull();
    cleanup();

    renderItem({ authorName: 'Bea Fisher' }, false);
    expect(screen.getByText('Bea')).toBeInTheDocument();
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText('Bea Fisher')).toBeNull();
  });

  test('an edit keeps the text and adds the edited label, which is otherwise absent', () => {
    renderItem();
    expect(screen.queryByText('(edited)')).toBeNull();
    cleanup();

    renderItem({ text: 'the new text', editedAt: EDITED_AT });
    expect(screen.getByText('the new text')).toBeInTheDocument();
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  test('a deleted message shows a tombstone and offers nothing to act on', () => {
    renderItem({ deletedAt: DELETED_AT });

    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    expect(screen.queryByText('the original text')).toBeNull();
    /** Even its own author has nothing left to edit or delete. */
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });
});

describe('accessible names', () => {
  test('each action names the message it acts on, trimmed to one short line', () => {
    renderItem({ text: 'ship it before lunch' });
    expect(
      screen.getByRole('button', { name: 'Edit message: ship it before lunch' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete message: ship it before lunch' }),
    ).toBeInTheDocument();
    cleanup();

    /** A long message is cut, so a screen reader is not read the whole thing. */
    renderItem({ text: 'a'.repeat(120) });
    expect(screen.getByRole('button', { name: /^Edit/ }).getAttribute('aria-label')).toBe(
      `Edit message: ${'a'.repeat(40)}…`,
    );
    cleanup();

    /** Newlines are collapsed so the name stays on one line. */
    renderItem({ text: 'line one\n\nline two' });
    expect(
      screen.getByRole('button', { name: 'Edit message: line one line two' }),
    ).toBeInTheDocument();
  });

  test('two messages give two distinct button names', () => {
    render(
      <>
        <MessageItem message={message({ text: 'first' })} isOwn onEdit={() => true} onDelete={() => true} />
        <MessageItem
          message={message({ messageId: 'm-2', text: 'second' })}
          isOwn
          onEdit={() => true}
          onDelete={() => true}
        />
      </>,
    );

    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Edit message: first');
    expect(names).toContain('Edit message: second');
  });
});

describe('editing', () => {
  test('saving sends the trimmed text, and an emptied field is never sent', async () => {
    const { onEdit, user } = renderItem();

    await user.click(screen.getByRole('button', { name: /^Edit/ }));
    await user.clear(screen.getByLabelText('Edit message'));
    await user.type(screen.getByLabelText('Edit message'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEdit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Edit message'), '  changed  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEdit).toHaveBeenCalledWith('m-1', 'changed');
    expect(screen.queryByLabelText('Edit message')).toBeNull();
  });

  test('the caret opens after the existing text, so typing appends', async () => {
    const { user } = renderItem();

    await user.click(screen.getByRole('button', { name: /^Edit/ }));
    const field = screen.getByLabelText<HTMLTextAreaElement>('Edit message');
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe('the original text'.length);

    await user.keyboard(' more');
    expect(field).toHaveValue('the original text more');
  });

  test('a rejected edit keeps the field open so the text is not lost', async () => {
    const onEdit = vi.fn(() => false);
    render(<MessageItem message={message()} isOwn onEdit={onEdit} onDelete={() => true} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^Edit/ }));
    await user.type(screen.getByLabelText('Edit message'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByLabelText('Edit message')).toHaveValue('the original text!');
  });

  test('Cancel and Escape both abandon the edit and send nothing', async () => {
    for (const abandon of ['cancel', 'escape'] as const) {
      const { onEdit, user } = renderItem();

      await user.click(screen.getByRole('button', { name: /^Edit/ }));
      await user.type(screen.getByLabelText('Edit message'), ' and more');

      if (abandon === 'cancel') {
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
      } else {
        await user.keyboard('{Escape}');
      }

      expect(onEdit).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Edit message')).toBeNull();
      expect(screen.getByText('the original text')).toBeInTheDocument();
      cleanup();
    }
  });

  test('closing the editor returns focus to the control that opened it', async () => {
    const { user } = renderItem();

    await user.click(screen.getByRole('button', { name: /^Edit/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: /^Edit/ })).toHaveFocus();
  });
});

describe('deleting', () => {
  test('delete reports the message id', async () => {
    const { onDelete, user } = renderItem();

    await user.click(screen.getByRole('button', { name: /^Delete/ }));

    expect(onDelete).toHaveBeenCalledWith('m-1');
  });
});
