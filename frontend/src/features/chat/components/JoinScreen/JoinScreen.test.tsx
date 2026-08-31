import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinScreen } from './JoinScreen';

function renderJoinScreen(overrides: Partial<Parameters<typeof JoinScreen>[0]> = {}) {
  const onJoin = vi.fn();
  render(
    <JoinScreen onJoin={onJoin} isJoining={false} connectionError={null} {...overrides} />,
  );
  return { onJoin, user: userEvent.setup() };
}

describe('JoinScreen', () => {
  /** Cleanup runs after each test, so a case inside a loop has to clear its own render. */
  it('joins with the name, tidied of surrounding and inner spacing', async () => {
    const names = [
      ['Alex Fisher', 'Alex Fisher'],
      ['  Alex Fisher  ', 'Alex Fisher'],
      ['Alex   Fisher', 'Alex Fisher'],
      ['Ada Byron Lovelace', 'Ada Byron Lovelace'],
    ];

    for (const [typed, expected] of names) {
      const { onJoin, user } = renderJoinScreen();

      await user.type(screen.getByLabelText('Display name'), typed);
      await user.click(screen.getByRole('button', { name: 'Join the standup' }));

      expect(onJoin).toHaveBeenCalledWith(expected);
      cleanup();
    }
  });

  /** A missing name and a one-word name are refused with different wording. */
  it('refuses anything that is not a first and last name, and says why', async () => {
    const missing = 'Enter your first and last name.';
    const oneWord = 'Enter your first and last name, so others can tell you apart.';
    const cases = [
      ['', missing],
      ['   ', missing],
      ['Alex', oneWord],
    ];

    for (const [typed, message] of cases) {
      const { onJoin, user } = renderJoinScreen();

      if (typed !== '') {
        await user.type(screen.getByLabelText('Display name'), typed);
      }
      await user.click(screen.getByRole('button', { name: 'Join the standup' }));

      expect(onJoin).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(String(message));
      cleanup();
    }
  });

  it('ties the validation message to the input for screen readers', async () => {
    const { user } = renderJoinScreen();
    const input = screen.getByLabelText('Display name');

    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter your first and last name.');
  });

  /** Section 15: transport wording such as "xhr poll error" must never be shown. */
  it('shows a connection failure without exposing transport wording', () => {
    renderJoinScreen({ connectionError: 'Cannot reach the chat server.' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Cannot reach the chat server.');
    expect(alert.textContent).not.toMatch(/xhr|poll|websocket|socket/i);
  });

  it('disables the form while joining', () => {
    renderJoinScreen({ isJoining: true });

    expect(screen.getByLabelText('Display name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
  });
});
