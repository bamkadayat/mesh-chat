import { useId, useState, type SubmitEvent } from 'react';
import { MAX_DISPLAY_NAME_LENGTH } from '../../model/constants';
import styles from './JoinScreen.module.css';

type JoinScreenProps = {
  onJoin: (displayName: string) => void;
  isJoining: boolean;
  connectionError: string | null;
};

export function JoinScreen({ onJoin, isJoining, connectionError }: JoinScreenProps) {
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputId = useId();
  const messageId = useId();

  /** The name is trimmed here so what you join with is what everyone sees. */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    const displayName = name.trim();
    if (displayName === '') {
      setValidationError('Enter a display name to join.');
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
          autoComplete="off"
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
          {isJoining ? 'Connecting…' : 'Join'}
        </button>
      </form>
    </main>
  );
}
