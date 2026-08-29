export type MessageToken =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string };

const URL_PATTERN = /https?:\/\/\S+/gi;

/** Punctuation that usually ends the sentence rather than the address. */
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]+$/;

/**
 * Splits text into plain and link pieces so the component can render real anchors.
 * It never builds HTML, which is what keeps dangerouslySetInnerHTML out of the app.
 */
export function linkify(text: string): MessageToken[] {
  const tokens: MessageToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    if (start === undefined) {
      continue;
    }

    const trailing = TRAILING_PUNCTUATION.exec(match[0])?.[0] ?? '';
    const candidate = trailing === '' ? match[0] : match[0].slice(0, -trailing.length);

    if (!isSafeUrl(candidate)) {
      continue;
    }

    if (start > cursor) {
      tokens.push({ kind: 'text', value: text.slice(cursor, start) });
    }
    tokens.push({ kind: 'link', value: candidate });
    cursor = start + candidate.length;
  }

  if (cursor < text.length) {
    tokens.push({ kind: 'text', value: text.slice(cursor) });
  }

  return tokens;
}

/**
 * Drops anything the URL parser rejects, such as https://[ or http://%%.
 * The scheme check repeats what URL_PATTERN already enforces, kept as a second
 * guard because linking a javascript: address would be an injection.
 */
function isSafeUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
