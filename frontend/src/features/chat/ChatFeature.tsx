import { useState, type SubmitEvent } from 'react';
import { JoinScreen } from './components/JoinScreen/JoinScreen';
import { MAX_MESSAGE_LENGTH } from './model/constants';
import { useChatSession } from './hooks/useChatSession';
import type { SessionErrorReason } from './model/types';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:3001';

/**
 * The wording lives here, not in the transport. A participant sees this text and
 * never a raw socket error such as xhr poll error.
 */
const ERROR_TEXT: Record<SessionErrorReason, string> = {
  'server-unreachable':
    'Cannot reach the chat server. Check that it is running, then try again.',
  'join-rejected': 'The session could not be joined with that name. Try another one.',
};

export function ChatFeature() {
  const session = useChatSession(SIGNALING_URL);
  const [draft, setDraft] = useState('');

  if (session.status === 'idle' || session.status === 'connecting' || session.status === 'error') {
    return (
      <JoinScreen
        onJoin={(displayName) => {
          void session.join(displayName);
        }}
        isJoining={session.status === 'connecting'}
        connectionError={session.errorReason === null ? null : ERROR_TEXT[session.errorReason]}
      />
    );
  }

  /** Temporary session view. The mockup panel replaces it in the next step. */
  /**
   * Readiness is re-checked here, not just on the button. It can change between
   * render and submit, and the field is cleared only once the send is accepted.
   */
  function handleSend(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    const text = draft.trim();
    if (text === '' || session.readiness !== 'open') {
      return;
    }

    if (session.sendMessage(text)) {
      setDraft('');
    }
  }

  return (
    <section>
      <p role="status">
        {session.status === 'reconnecting'
          ? 'Reconnecting to the chat server…'
          : `Connected · ${session.readiness}`}{' '}
        <button type="button" onClick={session.leave}>
          Leave
        </button>
      </p>

      <p>
        participants ({session.participants.length}):{' '}
        {session.participants.map((participant) => participant.displayName).join(', ')}
      </p>

      <ul>
        {session.timeline.map((item) =>
          item.kind === 'message' ? (
            <li key={item.message.messageId}>
              <b>{item.message.authorName}</b>: {item.message.text}
            </li>
          ) : (
            <li key={item.event.eventId}>
              {item.event.displayName} {item.event.type}
            </li>
          ),
        )}
      </ul>

      <form onSubmit={handleSend}>
        <label htmlFor="draft">Message</label>{' '}
        <input
          id="draft"
          maxLength={MAX_MESSAGE_LENGTH}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />{' '}
        <button type="submit" disabled={session.readiness !== 'open'}>
          Send
        </button>
      </form>
    </section>
  );
}
