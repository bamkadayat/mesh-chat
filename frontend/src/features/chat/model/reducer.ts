import type {
  ChatAction,
  ChatMessage,
  ChatState,
  TimelineItem,
} from './types';
import type {
  MessageCreateEvent,
  MessageDeleteEvent,
  MessageUpdateEvent,
} from '../protocol/protocol';

export const initialChatState: ChatState = { timeline: [] };

/**
 * Pure. Every unknown, duplicate or unauthorised action returns the state it was
 * given, so React sees the same reference and skips the re-render.
 */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.kind) {
    case 'system-event':
      return { timeline: [...state.timeline, { kind: 'system', event: action.event }] };
    case 'chat-event':
      switch (action.event.type) {
        case 'message:create':
          return createMessage(state, action.event.payload);
        case 'message:update':
          return updateMessage(state, action.event.payload);
        case 'message:delete':
          return deleteMessage(state, action.event.payload);
      }
  }
}

/**
 * The author applies its own event and also broadcasts it, so the same message
 * arrives twice. Adding by id only once makes that harmless.
 */
function createMessage(
  state: ChatState,
  payload: MessageCreateEvent['payload'],
): ChatState {
  if (findMessage(state, payload.messageId) !== null) {
    return state;
  }

  const message: ChatMessage = {
    messageId: payload.messageId,
    authorId: payload.authorId,
    authorName: payload.authorName,
    text: payload.text,
    createdAt: payload.createdAt,
    editedAt: null,
    deletedAt: null,
  };

  return { timeline: [...state.timeline, { kind: 'message', message }] };
}

/** Keeps the original author, name and creation time. Only text and editedAt change. */
function updateMessage(
  state: ChatState,
  payload: MessageUpdateEvent['payload'],
): ChatState {
  return replaceMessage(state, payload.messageId, payload.authorId, (message) => ({
    ...message,
    text: payload.text,
    editedAt: payload.editedAt,
  }));
}

/** Clears the text so deleted words are not left sitting in memory. */
function deleteMessage(
  state: ChatState,
  payload: MessageDeleteEvent['payload'],
): ChatState {
  return replaceMessage(state, payload.messageId, payload.authorId, (message) => ({
    ...message,
    text: '',
    deletedAt: payload.deletedAt,
  }));
}

/**
 * Compares against the author stored when the message was created, never against
 * the incoming event alone, so a peer cannot claim someone else's message.
 */
function replaceMessage(
  state: ChatState,
  messageId: string,
  claimedAuthorId: string,
  change: (message: ChatMessage) => ChatMessage,
): ChatState {
  const existing = findMessage(state, messageId);

  if (existing === null || existing.authorId !== claimedAuthorId) {
    return state;
  }

  const timeline = state.timeline.map((item) =>
    item.kind === 'message' && item.message.messageId === messageId
      ? { kind: 'message' as const, message: change(item.message) }
      : item,
  );

  return { timeline };
}

function findMessage(state: ChatState, messageId: string): ChatMessage | null {
  const found = state.timeline.find(
    (item: TimelineItem) => item.kind === 'message' && item.message.messageId === messageId,
  );
  return found?.kind === 'message' ? found.message : null;
}
