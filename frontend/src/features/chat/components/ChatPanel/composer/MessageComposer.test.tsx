import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageComposer } from './MessageComposer';

test('blank input is never sent', async () => {
  const onSend = vi.fn(() => true);
  render(<MessageComposer readiness="open" onSend={onSend} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), '   ');
  await user.keyboard('{Enter}');

  expect(onSend).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
});

test('the send button becomes usable as soon as there is real text', async () => {
  render(<MessageComposer readiness="open" onSend={() => true} />);
  const user = userEvent.setup();
  const send = screen.getByRole('button', { name: 'Send message' });

  expect(send).toBeDisabled();
  await user.type(screen.getByLabelText('Write to everyone'), 'hi');
  expect(send).toBeEnabled();
});

test('a message is trimmed, sent and cleared', async () => {
  const onSend = vi.fn(() => true);
  render(<MessageComposer readiness="open" onSend={onSend} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), '  hello  ');
  await user.click(screen.getByRole('button', { name: 'Send message' }));

  expect(onSend).toHaveBeenCalledWith('hello');
  expect(screen.getByLabelText('Write to everyone')).toHaveValue('');
});

test('a rejected send keeps the draft', async () => {
  const onSend = vi.fn(() => false);
  render(<MessageComposer readiness="open" onSend={onSend} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), 'hello');
  await user.keyboard('{Enter}');

  expect(onSend).toHaveBeenCalled();
  expect(screen.getByLabelText('Write to everyone')).toHaveValue('hello');
});

test('sending is blocked while an expected peer channel is not open', async () => {
  const onSend = vi.fn(() => true);
  render(<MessageComposer readiness="connecting" onSend={onSend} />);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Write to everyone'), 'hello');
  await user.keyboard('{Enter}');

  expect(onSend).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Connecting to participants');
});

test('the attachment and emoji controls are exposed as unavailable', () => {
  render(<MessageComposer readiness="open" onSend={() => true} />);

  expect(screen.getByRole('button', { name: /Attach files \(not available/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Choose emoji \(not available/ })).toBeDisabled();
});
