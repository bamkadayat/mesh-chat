import { useId, useState, type SubmitEvent } from 'react';
import { MAX_DISPLAY_NAME_LENGTH } from '../../model/constants';
import styles from './JoinScreen.module.css';

type JoinScreenProps = {
  onJoin: (displayName: string) => void;
  isJoining: boolean;
  connectionError: string | null;
};

/**
 * Names are presentation only and collisions are still allowed, so this asks
 * for a full name to make them less likely rather than to guarantee anything.
 * Inner whitespace is collapsed so "Bam   Kadayat" and "Bam Kadayat" match.
 */
function validateDisplayName(value: string): { name: string; error: string | null } {
  const name = value.trim().replace(/\s+/g, ' ');

  if (name === '') {
    return { name, error: 'Enter your first and last name.' };
  }
  if (!name.includes(' ')) {
    return { name, error: 'Enter your first and last name, so others can tell you apart.' };
  }

  return { name, error: null };
}

export function JoinScreen({ onJoin, isJoining, connectionError }: JoinScreenProps) {
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputId = useId();
  const messageId = useId();

  /** The name is normalised here so what you join with is what everyone sees. */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    const { name: displayName, error } = validateDisplayName(name);
    if (error !== null) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    onJoin(displayName);
  }

  const message = validationError ?? connectionError;

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>Mesh Chat</h1>
        <p className={styles.subtitle}>Join the status meeting standup.</p>

        <label className={styles.label} htmlFor={nameInputId}>
          Display name
        </label>
        <input
          id={nameInputId}
          className={styles.input}
          type="text"
          value={name}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          autoComplete="name"
          placeholder="First and last name"
          autoFocus
          disabled={isJoining}
          aria-invalid={validationError !== null}
          aria-describedby={message === null ? undefined : messageId}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />

        {message !== null && (
          <p id={messageId} className={styles.error} role="alert">
            {message}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={isJoining}>
          {isJoining ? 'Connecting…' : 'Join the standup'}
        </button>
      </form>
    </main>
  );
}
