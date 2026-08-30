import { describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageComposer } from './MessageComposer';

test('blank input is never sent', async () => {
  const onSend = vi.fn(() => true);
  render(<MessageComposer readiness="open" onSend={onSend} onTyping={() => undefined} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), '   ');
  await user.keyboard('{Enter}');

  expect(onSend).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
});

test('the send button becomes usable as soon as there is real text', async () => {
  render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
  const user = userEvent.setup();
  const send = screen.getByRole('button', { name: 'Send message' });

  expect(send).toBeDisabled();
  await user.type(screen.getByLabelText('Write to everyone'), 'hi');
  expect(send).toBeEnabled();
});

test('a message is trimmed, sent and cleared', async () => {
  const onSend = vi.fn(() => true);
  render(<MessageComposer readiness="open" onSend={onSend} onTyping={() => undefined} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), '  hello  ');
  await user.click(screen.getByRole('button', { name: 'Send message' }));

  expect(onSend).toHaveBeenCalledWith('hello');
  expect(screen.getByLabelText('Write to everyone')).toHaveValue('');
});

test('a rejected send keeps the draft', async () => {
  const onSend = vi.fn(() => false);
  render(<MessageComposer readiness="open" onSend={onSend} onTyping={() => undefined} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), 'hello');
  await user.keyboard('{Enter}');

  expect(onSend).toHaveBeenCalled();
  expect(screen.getByLabelText('Write to everyone')).toHaveValue('hello');
});

test('sending is blocked while an expected peer channel is not open', async () => {
  const onSend = vi.fn(() => true);
  render(<MessageComposer readiness="connecting" onSend={onSend} onTyping={() => undefined} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), 'hello');
  await user.keyboard('{Enter}');

  expect(onSend).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Connecting to participants');
});

test('the attachment control is exposed as unavailable', () => {
  render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);

  expect(screen.getByRole('button', { name: /Attach files \(not available/ })).toBeDisabled();
});

describe('typing announcements', () => {
  test('peers are told once, not per keystroke', async () => {
    const onTyping = vi.fn();
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={onTyping} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Write to everyone'), 'hello');

    expect(onTyping.mock.calls).toEqual([[true]]);
  });

  test('emptying the field says the typing stopped', async () => {
    const onTyping = vi.fn();
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={onTyping} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Write to everyone');

    await user.type(field, 'hello');
    await user.clear(field);

    expect(onTyping.mock.calls).toEqual([[true], [false]]);
  });

  test('sending says the typing stopped', async () => {
    const onTyping = vi.fn();
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={onTyping} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Write to everyone'), 'hello');
    await user.keyboard('{Enter}');

    expect(onTyping.mock.calls).toEqual([[true], [false]]);
  });

  test('whitespace alone does not count as typing', async () => {
    const onTyping = vi.fn();
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={onTyping} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Write to everyone'), '   ');

    expect(onTyping).not.toHaveBeenCalled();
  });

  test('unmounting mid-sentence does not strand the indicator', async () => {
    const onTyping = vi.fn();
    const view = render(
      <MessageComposer readiness="open" onSend={() => true} onTyping={onTyping} />,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Write to everyone'), 'hello');
    view.unmount();

    expect(onTyping.mock.calls).toEqual([[true], [false]]);
  });
});

describe('emoji picker', () => {
  const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Choose emoji' }));
    return screen.getByRole('dialog', { name: 'Choose emoji' });
  };

  test('the toggle reports whether the picker is open', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: 'Choose emoji' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('choosing an emoji inserts it at the caret, not at the end', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText<HTMLTextAreaElement>('Write to everyone');

    await user.type(field, 'hello world');
    field.setSelectionRange(5, 5);

    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'thumbs up' }));

    expect(field).toHaveValue('hello👍 world');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('the caret lands after the inserted emoji so typing continues there', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText<HTMLTextAreaElement>('Write to everyone');

    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'rocket' }));

    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe('🚀'.length);
    await user.keyboard(' ship it');
    expect(field).toHaveValue('🚀 ship it');
  });

  test('an emoji replaces the selected text', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText<HTMLTextAreaElement>('Write to everyone');

    await user.type(field, 'yes no');
    field.setSelectionRange(4, 6);

    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'thumbs up' }));

    expect(field).toHaveValue('yes 👍');
  });

  test('the picker opens with focus on it and arrow keys move through it', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    await openPicker(user);

    expect(screen.getByRole('button', { name: 'grinning face' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'face with tears of joy' })).toHaveFocus();

    /** eight per row, so down moves eight further on */
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'partying face' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'smiling face with sunglasses' })).toHaveFocus();
  });

  test('only one emoji is a tab stop, so Tab does not walk the whole grid', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    const panel = await openPicker(user);

    const tabbable = within(panel)
      .getAllByRole('button')
      .filter((button) => button.getAttribute('tabindex') !== '-1');

    expect(within(panel).getAllByRole('button').length).toBeGreaterThan(10);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName('grinning face');
  });

  test('an emoji can be chosen with the keyboard alone', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    await openPicker(user);

    await user.keyboard('{ArrowRight}{Enter}');

    expect(screen.getByLabelText('Write to everyone')).toHaveValue('😂');
  });

  test('Escape closes the picker and returns focus to the field', async () => {
    render(<MessageComposer readiness="open" onSend={() => true} onTyping={() => undefined} />);
    const user = userEvent.setup();
    await openPicker(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Write to everyone')).toHaveFocus();
  });
});
