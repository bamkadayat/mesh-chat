import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('ownership', () => {
  test('the author gets edit and delete controls', () => {
    renderItem();

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  test('another participant gets no controls', () => {
    renderItem({}, false);

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  test('a deleted message offers nothing to act on, even to its author', () => {
    renderItem({ deletedAt: '2026-08-30T09:16:00.000Z' });

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});

describe('rendering', () => {
  test('an edited message keeps its text and gains the edited label', () => {
    renderItem({ text: 'the new text', editedAt: '2026-08-30T09:16:00.000Z' });

    expect(screen.getByText('the new text')).toBeInTheDocument();
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  test('a deleted message shows a tombstone instead of its text', () => {
    renderItem({ deletedAt: '2026-08-30T09:16:00.000Z' });

    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    expect(screen.queryByText('the original text')).toBeNull();
  });

  test('an unedited message has no edited label', () => {
    renderItem();

    expect(screen.queryByText('(edited)')).toBeNull();
  });
});

describe('editing', () => {
  test('saving sends the trimmed text and closes the field', async () => {
    const { onEdit, user } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Edit message'));
    await user.type(screen.getByLabelText('Edit message'), '  changed  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).toHaveBeenCalledWith('m-1', 'changed');
    expect(screen.queryByLabelText('Edit message')).toBeNull();
  });

  test('the caret opens after the existing text, so typing appends', async () => {
    const { user } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const field = screen.getByLabelText<HTMLTextAreaElement>('Edit message');
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe('the original text'.length);

    await user.keyboard(' more');
    expect(field).toHaveValue('the original text more');
  });

  test('closing the editor returns focus to the control that opened it', async () => {
    const { user } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
  });

  test('a rejected edit keeps the field open so the text is not lost', async () => {
    const onEdit = vi.fn(() => false);
    render(
      <MessageItem message={message()} isOwn onEdit={onEdit} onDelete={() => true} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Edit message'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByLabelText('Edit message')).toHaveValue('the original text!');
  });

  test('an emptied field is never saved', async () => {
    const { onEdit, user } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Edit message'));
    await user.type(screen.getByLabelText('Edit message'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).not.toHaveBeenCalled();
  });

  test('cancelling restores the original text and sends nothing', async () => {
    const { onEdit, user } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Edit message'), ' and more');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText('the original text')).toBeInTheDocument();
  });

  test('Escape abandons the edit', async () => {
    const { onEdit, user } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Edit message'), '{Escape}');

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Edit message')).toBeNull();
  });
});

describe('deleting', () => {
  test('delete reports the message id', async () => {
    const { onDelete, user } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledWith('m-1');
  });
});
