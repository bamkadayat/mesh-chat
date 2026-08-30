import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react';
import { MAX_MESSAGE_LENGTH } from '../../../model/constants';
import type { ChatMessage } from '../../../model/types';
import { linkify } from '../../../protocol/linkify';
import { firstName } from './firstName';
import { formatTime } from './formatTime';
import styles from './MessageItem.module.css';

type MessageItemProps = {
  message: ChatMessage;
  isOwn: boolean;
  onEdit: (messageId: string, text: string) => boolean;
  onDelete: (messageId: string) => boolean;
};

/** Text is split into tokens and rendered as real anchors, never as HTML. */
function MessageText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((token, index) =>
        token.kind === 'link' ? (
          <a
            key={index}
            className={styles.link}
            href={token.value}
            target="_blank"
            rel="noopener noreferrer"
          >
            {token.value}
          </a>
        ) : (
          <span key={index}>{token.value}</span>
        ),
      )}
    </>
  );
}

/**
 * A screen reader can list the buttons on their own, where four of them reading
 * "Edit, Delete, Edit, Delete" say nothing about which message they act on.
 */
function actionLabel(action: string, text: string): string {
  const preview = text.replace(/\s+/g, ' ').trim();
  return `${action} message: ${preview.length > 40 ? `${preview.slice(0, 40)}…` : preview}`;
}

export function MessageItem({ message, isOwn, onEdit, onDelete }: MessageItemProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const wasEditing = useRef(false);
  const isDeleted = message.deletedAt !== null;
  const isEditing = draft !== null;

  /**
   * autoFocus would leave the caret before the existing text, so typing would
   * prepend. Place it at the end, where someone amending a message expects it.
   */
  useEffect(() => {
    const field = fieldRef.current;
    if (isEditing && field !== null) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  }, [isEditing]);

  /** Closing the editor must put focus back on the control that opened it. */
  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      editButtonRef.current?.focus();
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  /** A deleted message keeps its tombstone, so there is nothing left to act on. */
  const canAct = isOwn && !isDeleted;

  /** The field is closed only once the edit is accepted, so rejected text survives. */
  function save(): void {
    const text = draft?.trim() ?? '';
    if (text !== '' && onEdit(message.messageId, text)) {
      setDraft(null);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    save();
  }

  /** Enter saves and Escape abandons the edit, matching the composer's Enter. */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      save();
    }
    if (event.key === 'Escape') {
      setDraft(null);
    }
  }

  return (
    <li className={isOwn ? `${styles.item} ${styles.own}` : styles.item}>
      <p className={styles.header}>
        <span className={styles.author}>{isOwn ? 'You' : firstName(message.authorName)}</span>
        <time className={styles.time} dateTime={message.createdAt}>
          {formatTime(message.createdAt)}
        </time>
      </p>

      {isEditing ? (
        <form className={styles.editor} onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor={`edit-${message.messageId}`}>
            Edit message
          </label>
          <textarea
            id={`edit-${message.messageId}`}
            ref={fieldRef}
            className={styles.editField}
            value={draft}
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className={styles.editActions}>
            <button type="submit" className={styles.save}>
              Save
            </button>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => {
                setDraft(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className={isDeleted ? styles.tombstone : styles.body}>
          {isDeleted ? (
            'Message deleted'
          ) : (
            <>
              <MessageText text={message.text} />
              {message.editedAt !== null && <span className={styles.edited}> (edited)</span>}
            </>
          )}
        </p>
      )}

      {canAct && !isEditing && (
        <div className={styles.actions}>
          <button
            type="button"
            ref={editButtonRef}
            className={styles.action}
            aria-label={actionLabel('Edit', message.text)}
            onClick={() => {
              setDraft(message.text);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.action}
            aria-label={actionLabel('Delete', message.text)}
            onClick={() => {
              onDelete(message.messageId);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
