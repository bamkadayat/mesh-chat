import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinScreen } from './JoinScreen';
import { MAX_DISPLAY_NAME_LENGTH } from '../../model/constants';

function renderJoinScreen(overrides: Partial<Parameters<typeof JoinScreen>[0]> = {}) {
  const onJoin = vi.fn();
  render(
    <JoinScreen onJoin={onJoin} isJoining={false} connectionError={null} {...overrides} />,
  );
  return { onJoin, user: userEvent.setup() };
}

describe('JoinScreen', () => {
  it('joins with the entered name', async () => {
    const { onJoin, user } = renderJoinScreen();

    await user.type(screen.getByLabelText('Display name'), 'Alex Fisher');
    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(onJoin).toHaveBeenCalledWith('Alex Fisher');
  });

  it('trims surrounding whitespace from the name', async () => {
    const { onJoin, user } = renderJoinScreen();

    await user.type(screen.getByLabelText('Display name'), '  Alex Fisher  ');
    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(onJoin).toHaveBeenCalledWith('Alex Fisher');
  });

  it('collapses inner whitespace so spacing cannot make two names differ', async () => {
    const { onJoin, user } = renderJoinScreen();

    await user.type(screen.getByLabelText('Display name'), 'Alex   Fisher');
    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(onJoin).toHaveBeenCalledWith('Alex Fisher');
  });

  it('does not join with a single word, and says why', async () => {
    const { onJoin, user } = renderJoinScreen();

    await user.type(screen.getByLabelText('Display name'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('first and last name');
  });

  it('accepts a name of more than two words', async () => {
    const { onJoin, user } = renderJoinScreen();

    await user.type(screen.getByLabelText('Display name'), 'Ada Byron Lovelace');
    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(onJoin).toHaveBeenCalledWith('Ada Byron Lovelace');
  });

  it('does not join with an empty name', async () => {
    const { onJoin, user } = renderJoinScreen();

    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(onJoin).not.toHaveBeenCalled();
  });

  it('does not join with only whitespace', async () => {
    const { onJoin, user } = renderJoinScreen();

    await user.type(screen.getByLabelText('Display name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(onJoin).not.toHaveBeenCalled();
  });

  it('explains why an empty name was rejected', async () => {
    const { user } = renderJoinScreen();

    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a display name to join.');
  });

  it('ties the validation message to the input for screen readers', async () => {
    const { user } = renderJoinScreen();
    const input = screen.getByLabelText('Display name');

    await user.click(screen.getByRole('button', { name: 'Join the standup' }));

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a display name to join.');
  });

  it('caps the name at the documented maximum length', () => {
    renderJoinScreen();

    expect(screen.getByLabelText('Display name')).toHaveAttribute(
      'maxlength',
      String(MAX_DISPLAY_NAME_LENGTH),
    );
  });

  it('shows a connection failure without exposing transport wording', () => {
    renderJoinScreen({ connectionError: 'Cannot reach the chat server.' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Cannot reach the chat server.');
    expect(alert.textContent).not.toMatch(/xhr|poll|websocket|socket/i);
  });

  it('keeps the form usable after a failure so the user can retry', () => {
    renderJoinScreen({ connectionError: 'Cannot reach the chat server.' });

    expect(screen.getByRole('button', { name: 'Join the standup' })).toBeEnabled();
    expect(screen.getByLabelText('Display name')).toBeEnabled();
  });

  it('disables the form while joining', () => {
    renderJoinScreen({ isJoining: true });

    expect(screen.getByLabelText('Display name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
  });
});
