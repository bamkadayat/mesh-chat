import { describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageComposer } from './MessageComposer';

function renderComposer(
  overrides: Partial<Parameters<typeof MessageComposer>[0]> = {},
) {
  const onSend = vi.fn(() => true);
  const onTyping = vi.fn();
  const view = render(
    <MessageComposer readiness="open" onSend={onSend} onTyping={onTyping} {...overrides} />,
  );
  return { onSend, onTyping, view, user: userEvent.setup() };
}

const field = () => screen.getByLabelText<HTMLTextAreaElement>('Write to everyone');
const sendButton = () => screen.getByRole('button', { name: 'Send message' });

describe('sending', () => {
  test('blank input is never sent, and real text enables the button', async () => {
    const { onSend, user } = renderComposer();

    expect(sendButton()).toBeDisabled();
    await user.type(field(), '   ');
    await user.keyboard('{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(sendButton()).toBeDisabled();

    await user.type(field(), 'hi');
    expect(sendButton()).toBeEnabled();
  });

  test('a message is trimmed, sent and cleared', async () => {
    const { onSend, user } = renderComposer();

    await user.type(field(), '  hello  ');
    await user.click(sendButton());

    expect(onSend).toHaveBeenCalledWith('hello');
    expect(field()).toHaveValue('');
  });

  test('a rejected send keeps the draft', async () => {
    /** The rejecting mock has to be the one asserted on, not the default. */
    const onSend = vi.fn(() => false);
    const { user } = renderComposer({ onSend });

    await user.type(field(), 'hello');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('hello');
    expect(field()).toHaveValue('hello');
  });

  test('sending is blocked while an expected peer channel is not open', async () => {
    const { onSend, user } = renderComposer({ readiness: 'connecting' });

    await user.type(field(), 'hello');
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to participants');
  });

  test('the attachment control is exposed as unavailable', () => {
    renderComposer();

    expect(screen.getByRole('button', { name: /Attach files \(not available/ })).toBeDisabled();
  });
});

describe('typing announcements', () => {
  test('peers are told once, not per keystroke, and whitespace does not count', async () => {
    const { onTyping, user } = renderComposer();

    await user.type(field(), '   ');
    expect(onTyping).not.toHaveBeenCalled();

    await user.type(field(), 'hello');
    expect(onTyping.mock.calls).toEqual([[true]]);
  });

  test('typing stops after clearing the field and after sending', async () => {
    const cleared = renderComposer();
    await cleared.user.type(field(), 'hello');
    await cleared.user.clear(field());
    expect(cleared.onTyping.mock.calls).toEqual([[true], [false]]);
    cleanup();

    const sent = renderComposer();
    await sent.user.type(field(), 'hello');
    await sent.user.keyboard('{Enter}');
    expect(sent.onTyping.mock.calls).toEqual([[true], [false]]);
  });

  test('unmounting mid-sentence does not strand the indicator', async () => {
    const { onTyping, view, user } = renderComposer();

    await user.type(field(), 'hello');
    view.unmount();

    expect(onTyping.mock.calls).toEqual([[true], [false]]);
  });
});

describe('emoji picker', () => {
  const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Choose emoji' }));
    return screen.getByRole('dialog', { name: 'Choose emoji' });
  };

  test('the picker opens and closes accessibly', async () => {
    const { user } = renderComposer();
    const toggle = screen.getByRole('button', { name: 'Choose emoji' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();

    await openPicker(user);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field()).toHaveFocus();
  });

  test('an emoji inserts at the caret, leaves it after, and replaces a selection', async () => {
    const inserted = renderComposer();
    await inserted.user.type(field(), 'hello world');
    field().setSelectionRange(5, 5);
    await openPicker(inserted.user);
    await inserted.user.click(screen.getByRole('button', { name: 'thumbs up' }));
    expect(field()).toHaveValue('hello👍 world');
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();

    /** The caret follows the emoji, so typing carries on after it. */
    const caret = renderComposer();
    await openPicker(caret.user);
    await caret.user.click(screen.getByRole('button', { name: 'rocket' }));
    expect(field()).toHaveFocus();
    expect(field().selectionStart).toBe('🚀'.length);
    await caret.user.keyboard(' ship it');
    expect(field()).toHaveValue('🚀 ship it');
    cleanup();

    const selection = renderComposer();
    await selection.user.type(field(), 'yes no');
    field().setSelectionRange(4, 6);
    await openPicker(selection.user);
    await selection.user.click(screen.getByRole('button', { name: 'thumbs up' }));
    expect(field()).toHaveValue('yes 👍');
  });

  test('the picker is keyboard operable and holds a single tab stop', async () => {
    const { user } = renderComposer();
    const panel = await openPicker(user);

    /** A roving tabindex, so Tab does not walk the whole grid. */
    const tabbable = within(panel)
      .getAllByRole('button')
      .filter((button) => button.getAttribute('tabindex') !== '-1');
    expect(within(panel).getAllByRole('button').length).toBeGreaterThan(10);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName('grinning face');
    expect(screen.getByRole('button', { name: 'grinning face' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'face with tears of joy' })).toHaveFocus();

    /** Eight per row, so down moves eight further on. */
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'partying face' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'smiling face with sunglasses' })).toHaveFocus();

    await user.keyboard('{ArrowUp}{ArrowRight}{Enter}');
    expect(field()).toHaveValue('😂');
  });
});
