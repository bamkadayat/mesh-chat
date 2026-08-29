import { MAX_DISPLAY_NAME_LENGTH, MAX_MESSAGE_LENGTH } from '../model/constants';

export type MessageCreateEvent = {
  type: 'message:create';
  payload: {
    messageId: string;
    authorId: string;
    authorName: string;
    text: string;
    createdAt: string;
  };
};

export type MessageUpdateEvent = {
  type: 'message:update';
  payload: {
    messageId: string;
    authorId: string;
    text: string;
    editedAt: string;
  };
};

export type MessageDeleteEvent = {
  type: 'message:delete';
  payload: {
    messageId: string;
    authorId: string;
    deletedAt: string;
  };
};

export type ChatEvent = MessageCreateEvent | MessageUpdateEvent | MessageDeleteEvent;

/** Turns an event into the string sent over the data channel. */
export function serializeChatEvent(event: ChatEvent): string {
  return JSON.stringify(event);
}

/**
 * A peer can send anything, so this returns null instead of throwing.
 * A bad frame is dropped and the app carries on.
 */
export function parseChatEvent(raw: string): ChatEvent | null {
  const value = parseJson(raw);

  if (!isRecord(value) || !isRecord(value.payload)) {
    return null;
  }

  switch (value.type) {
    case 'message:create':
      return readCreate(value.payload);
    case 'message:update':
      return readUpdate(value.payload);
    case 'message:delete':
      return readDelete(value.payload);
    default:
      return null;
  }
}

/** Malformed JSON is expected from an untrusted peer, so it is a null, not a throw. */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const name = value.trim();
  return name.length > 0 && name.length <= MAX_DISPLAY_NAME_LENGTH ? name : null;
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return text.length > 0 && text.length <= MAX_MESSAGE_LENGTH ? text : null;
}

/** Accepts any string Date can read, so a peer cannot send a nonsense timestamp. */
function readTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function readCreate(payload: Record<string, unknown>): MessageCreateEvent | null {
  const messageId = readId(payload.messageId);
  const authorId = readId(payload.authorId);
  const authorName = readName(payload.authorName);
  const text = readText(payload.text);
  const createdAt = readTimestamp(payload.createdAt);

  if (
    messageId === null ||
    authorId === null ||
    authorName === null ||
    text === null ||
    createdAt === null
  ) {
    return null;
  }

  return {
    type: 'message:create',
    payload: { messageId, authorId, authorName, text, createdAt },
  };
}

function readUpdate(payload: Record<string, unknown>): MessageUpdateEvent | null {
  const messageId = readId(payload.messageId);
  const authorId = readId(payload.authorId);
  const text = readText(payload.text);
  const editedAt = readTimestamp(payload.editedAt);

  if (messageId === null || authorId === null || text === null || editedAt === null) {
    return null;
  }

  return { type: 'message:update', payload: { messageId, authorId, text, editedAt } };
}

function readDelete(payload: Record<string, unknown>): MessageDeleteEvent | null {
  const messageId = readId(payload.messageId);
  const authorId = readId(payload.authorId);
  const deletedAt = readTimestamp(payload.deletedAt);

  if (messageId === null || authorId === null || deletedAt === null) {
    return null;
  }

  return { type: 'message:delete', payload: { messageId, authorId, deletedAt } };
}
