import { useState, type SubmitEvent } from 'react';
import { useChatSession } from './hooks/useChatSession';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:3001';

/**
 * Temporary slice for step 11. It exists to prove a message travels browser to
 * browser over a data channel. The real screens replace it in steps 12 and 13.
 */
export function ChatFeature() {
  const session = useChatSession(SIGNALING_URL);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState('');

  function handleJoin(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed !== '') {
      void session.join(trimmed);
    }
  }

  function handleSend(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed !== '') {
      session.sendMessage(trimmed);
      setDraft('');
    }
  }

  if (session.status === 'idle') {
    return (
      <form onSubmit={handleJoin}>
        <label htmlFor="name">Display name</label>{' '}
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} />{' '}
        <button type="submit">Join</button>
      </form>
    );
  }

  return (
    <section>
      <p>
        status <b data-testid="status">{session.status}</b>
        {' · '}readiness <b data-testid="readiness">{session.readiness}</b>
        {' · '}
        <button type="button" onClick={session.leave}>
          Leave
        </button>
      </p>

      <p data-testid="participants">
        participants ({session.participants.length}):{' '}
        {session.participants
          .map((p) => `${p.displayName} [${p.participantId.slice(0, 8)}]`)
          .join(', ')}
      </p>

      <ul data-testid="timeline">
        {session.timeline.map((item) =>
          item.kind === 'message' ? (
            <li key={item.message.messageId} data-testid="message">
              <b>{item.message.authorName}</b>: {item.message.text}
            </li>
          ) : (
            <li key={item.event.eventId} data-testid="system">
              {item.event.displayName} {item.event.type}
            </li>
          ),
        )}
      </ul>

      <form onSubmit={handleSend}>
        <label htmlFor="draft">Message</label>{' '}
        <input id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} />{' '}
        <button type="submit" disabled={session.readiness !== 'open'}>
          Send
        </button>
      </form>
    </section>
  );
}
