import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styles from './EmojiPicker.module.css';

/** Small emoji list with readable names for screen readers. */
const EMOJI: { char: string; name: string }[] = [
  { char: '😀', name: 'grinning face' },
  { char: '😂', name: 'face with tears of joy' },
  { char: '🙂', name: 'slightly smiling face' },
  { char: '😉', name: 'winking face' },
  { char: '😍', name: 'smiling face with hearts' },
  { char: '🤔', name: 'thinking face' },
  { char: '😅', name: 'grinning face with sweat' },
  { char: '😴', name: 'sleeping face' },
  { char: '😎', name: 'smiling face with sunglasses' },
  { char: '🥳', name: 'partying face' },
  { char: '😢', name: 'crying face' },
  { char: '😡', name: 'angry face' },
  { char: '👍', name: 'thumbs up' },
  { char: '👎', name: 'thumbs down' },
  { char: '👏', name: 'clapping hands' },
  { char: '🙌', name: 'raising hands' },
  { char: '🙏', name: 'folded hands' },
  { char: '👋', name: 'waving hand' },
  { char: '💪', name: 'flexed biceps' },
  { char: '🤝', name: 'handshake' },
  { char: '❤️', name: 'red heart' },
  { char: '🔥', name: 'fire' },
  { char: '✨', name: 'sparkles' },
  { char: '🎉', name: 'party popper' },
  { char: '✅', name: 'check mark' },
  { char: '❌', name: 'cross mark' },
  { char: '⚠️', name: 'warning' },
  { char: '🚀', name: 'rocket' },
  { char: '🐛', name: 'bug' },
  { char: '☕', name: 'hot beverage' },
  { char: '📌', name: 'pushpin' },
  { char: '👀', name: 'eyes' },
];

const COLUMNS = 8;

type EmojiPickerProps = {
  id: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function EmojiPicker({ id, onSelect, onClose }: EmojiPickerProps) {
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Opening moves focus into the panel, so the keyboard can reach the emoji. */
  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  /** A click anywhere else is a dismissal, the same as pressing Escape. */
  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      const panel = panelRef.current;
      if (panel !== null && event.target instanceof Node && !panel.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [onClose]);

  /** Arrows walk the grid, so the list is usable without a pointer. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    };

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    const step = moves[event.key];
    if (step === undefined) {
      return;
    }

    event.preventDefault();
    const next = active + step;
    if (next < 0 || next >= EMOJI.length) {
      return;
    }

    setActive(next);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      id={id}
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label="Choose emoji"
      onKeyDown={handleKeyDown}
    >
      {EMOJI.map((emoji, index) => (
        <button
          key={emoji.char}
          type="button"
          className={styles.emoji}
          tabIndex={index === active ? 0 : -1}
          aria-label={emoji.name}
          ref={(element) => {
            buttonRefs.current[index] = element;
          }}
          onClick={() => {
            onSelect(emoji.char);
          }}
        >
          <span aria-hidden="true">{emoji.char}</span>
        </button>
      ))}
    </div>
  );
}
