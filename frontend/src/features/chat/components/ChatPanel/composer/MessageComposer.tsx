import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from 'react';
import { EmojiPicker } from './EmojiPicker';
import { MAX_MESSAGE_LENGTH, TYPING_IDLE_MS } from '../../../model/constants';
import type { ComposerReadiness } from '../../../model/types';
import styles from './MessageComposer.module.css';

type MessageComposerProps = {
  readiness: ComposerReadiness;
  onSend: (text: string) => boolean;
  onTyping: (isTyping: boolean) => void;
};

/** Wording for why sending is unavailable. Empty while everything is ready. */
function readinessNotice(readiness: ComposerReadiness): string {
  switch (readiness) {
    case 'waiting':
      return 'Waiting for another participant…';
    case 'connecting':
      return 'Connecting to participants…';
    case 'failed':
      return 'Connection lost. Leave and rejoin to continue.';
    case 'open':
      return '';
  }
}

export function MessageComposer({ readiness, onSend, onTyping }: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const [isPickerOpen, setPickerOpen] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  /** Where to put the caret after the next render, once an emoji is inserted. */
  const pendingCaret = useRef<number | null>(null);
  /** Whether peers currently believe this participant is typing. */
  const announced = useRef(false);
  const fieldId = useId();
  const noticeId = useId();
  const pickerId = useId();

  /**
   * Grows the field with its text up to the CSS max-height. Reset to auto first
   * so it shrinks again when text is removed.
   */
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (field === null) {
      return;
    }

    field.style.height = 'auto';
    field.style.height = `${String(field.scrollHeight)}px`;

    /** An inserted emoji leaves the caret behind it, so it is moved here. */
    if (pendingCaret.current !== null) {
      field.focus();
      field.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [draft]);

  const notice = readinessNotice(readiness);
  const canSend = readiness === 'open' && draft.trim() !== '';

  /**
   * Readiness is checked here as well as on the button, and the field is cleared
   * only once the send is accepted, so a rejected message is never lost.
   */
  function submit(): void {
    if (canSend && onSend(draft.trim())) {
      setDraft('');
    }
  }

  /** Inserts at the caret, replacing a selection, so it behaves like typing. */
  function insertEmoji(emoji: string): void {
    const field = fieldRef.current;
    const start = field?.selectionStart ?? draft.length;
    const end = field?.selectionEnd ?? draft.length;

    pendingCaret.current = start + emoji.length;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    setPickerOpen(false);
  }

  /**
   * Peers hear "typing" once, not per keystroke, and hear "stopped" after a
   * short quiet spell. Without the quiet timer, walking away would leave the
   * indicator showing until the expiry on the other side.
   */
  const announceTyping = useCallback(
    (isTyping: boolean): void => {
      if (announced.current === isTyping) {
        return;
      }
      announced.current = isTyping;
      onTyping(isTyping);
    },
    [onTyping],
  );

  useEffect(() => {
    if (draft.trim() === '') {
      announceTyping(false);
      return;
    }

    announceTyping(true);
    const timer = setTimeout(() => {
      announceTyping(false);
    }, TYPING_IDLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [draft, announceTyping]);

  /** Leaving the panel mid-sentence must not strand the indicator. */
  useEffect(() => {
    return () => {
      announceTyping(false);
    };
  }, [announceTyping]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    submit();
  }

  /** Enter sends, Shift+Enter starts a new line. */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      {isPickerOpen && (
        <EmojiPicker
          id={pickerId}
          onSelect={insertEmoji}
          onClose={() => {
            setPickerOpen(false);
            fieldRef.current?.focus();
          }}
        />
      )}

      {/* One bordered box holding the field and the action row, as the mockup
          shows. The box carries the focus ring, not the bare textarea. */}
      <div className={styles.field}>
        <label className="visually-hidden" htmlFor={fieldId}>
          Write to everyone
        </label>
        <textarea
          id={fieldId}
          ref={fieldRef}
          className={styles.input}
          value={draft}
          placeholder="Write to everyone"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-describedby={notice === '' ? undefined : noticeId}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            disabled
            aria-label="Attach files (not available in this demo)"
          >
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path
                d="M12 3.5v17M3.5 12h17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className={styles.action}
            aria-label="Choose emoji"
            aria-haspopup="dialog"
            aria-expanded={isPickerOpen}
            aria-controls={isPickerOpen ? pickerId : undefined}
            onClick={() => {
              setPickerOpen((open) => !open);
            }}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 17.5c-2.3 0-4.3-1.4-5.1-3.5h10.2c-.8 2.1-2.8 3.5-5.1 3.5z"
              />
            </svg>
          </button>

          {/* Always present, so the row never changes shape as you type. It is
              the only control here that turns on and off. */}
          <button type="submit" className={styles.send} disabled={!canSend} aria-label="Send message">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      </div>

      {notice !== '' && (
        <p className={styles.notice} id={noticeId} role="status">
          {notice}
        </p>
      )}
    </form>
  );
}
