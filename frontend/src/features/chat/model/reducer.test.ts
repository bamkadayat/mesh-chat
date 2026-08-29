import { describe, expect, it } from 'vitest';
import { chatReducer, initialChatState } from './reducer';
import type { ChatAction, ChatMessage, ChatState } from './types';

const AUTHOR = 'author-1';
const IMPOSTOR = 'author-2';

function create(messageId = 'm1', authorId = AUTHOR, text = 'hello'): ChatAction {
  return {
    kind: 'chat-event',
    event: {
      type: 'message:create',
      payload: {
        messageId,
        authorId,
        authorName: 'Alex',
        text,
        createdAt: '2026-08-29T09:00:00.000Z',
      },
    },
  };
}

function update(messageId = 'm1', authorId = AUTHOR, text = 'edited'): ChatAction {
  return {
    kind: 'chat-event',
    event: {
      type: 'message:update',
      payload: { messageId, authorId, text, editedAt: '2026-08-29T09:05:00.000Z' },
    },
  };
}

function remove(messageId = 'm1', authorId = AUTHOR): ChatAction {
  return {
    kind: 'chat-event',
    event: {
      type: 'message:delete',
      payload: { messageId, authorId, deletedAt: '2026-08-29T09:09:00.000Z' },
    },
  };
}

/** Reads the first message out of the timeline, or fails the test if there is none. */
function firstMessage(state: ChatState): ChatMessage {
  const item = state.timeline.find((entry) => entry.kind === 'message');
  if (item?.kind !== 'message') {
    throw new Error('timeline holds no message');
  }
  return item.message;
}

const withOneMessage = chatReducer(initialChatState, create());

describe('chatReducer create', () => {
  it('creates a message', () => {
    expect(withOneMessage.timeline).toHaveLength(1);
    expect(firstMessage(withOneMessage).text).toBe('hello');
  });

  it('starts a message with no edited or deleted marker', () => {
    expect(firstMessage(withOneMessage).editedAt).toBeNull();
    expect(firstMessage(withOneMessage).deletedAt).toBeNull();
  });

  it('ignores a duplicate create with the same id', () => {
    const next = chatReducer(withOneMessage, create());
    expect(next.timeline).toHaveLength(1);
    expect(next).toBe(withOneMessage);
  });
});

describe('chatReducer update', () => {
  it('edits a message when the author matches', () => {
    expect(firstMessage(chatReducer(withOneMessage, update())).text).toBe('edited');
  });

  it('keeps the original author, name and creation time', () => {
    const edited = firstMessage(chatReducer(withOneMessage, update()));
    expect(edited.authorId).toBe(AUTHOR);
    expect(edited.authorName).toBe('Alex');
    expect(edited.createdAt).toBe('2026-08-29T09:00:00.000Z');
  });

  it('marks the message as edited', () => {
    expect(firstMessage(chatReducer(withOneMessage, update())).editedAt).toBe(
      '2026-08-29T09:05:00.000Z',
    );
  });

  it('rejects an edit from a different author', () => {
    const next = chatReducer(withOneMessage, update('m1', IMPOSTOR));
    expect(next).toBe(withOneMessage);
    expect(firstMessage(next).text).toBe('hello');
  });

  it('ignores an edit for an unknown message id', () => {
    expect(chatReducer(withOneMessage, update('unknown'))).toBe(withOneMessage);
  });
});

describe('chatReducer delete', () => {
  it('deletes a message when the author matches', () => {
    expect(firstMessage(chatReducer(withOneMessage, remove())).deletedAt).toBe(
      '2026-08-29T09:09:00.000Z',
    );
  });

  it('keeps the deleted message in the timeline as a tombstone', () => {
    const next = chatReducer(withOneMessage, remove());
    expect(next.timeline).toHaveLength(1);
    expect(firstMessage(next).messageId).toBe('m1');
  });

  it('clears the text of a deleted message', () => {
    expect(firstMessage(chatReducer(withOneMessage, remove())).text).toBe('');
  });

  it('rejects a delete from a different author', () => {
    expect(chatReducer(withOneMessage, remove('m1', IMPOSTOR))).toBe(withOneMessage);
  });

  it('ignores a delete for an unknown message id', () => {
    expect(chatReducer(withOneMessage, remove('unknown'))).toBe(withOneMessage);
  });
});

describe('chatReducer timeline order', () => {
  const joined: ChatAction = {
    kind: 'system-event',
    event: {
      eventId: 'e1',
      type: 'participant-joined',
      displayName: 'Sam',
      occurredAt: '2026-08-29T09:01:00.000Z',
    },
  };

  const mixed = [create('m1'), joined, create('m2', 'author-3', 'second')].reduce(
    chatReducer,
    initialChatState,
  );

  it('keeps messages and system events in arrival order', () => {
    expect(mixed.timeline.map((item) => item.kind)).toEqual(['message', 'system', 'message']);
  });

  it('does not move a message when it is edited', () => {
    const next = chatReducer(mixed, update('m1'));
    expect(next.timeline.map((item) => item.kind)).toEqual(['message', 'system', 'message']);
  });

  it('does not mutate the state it was given', () => {
    const before = JSON.stringify(mixed);
    chatReducer(mixed, update('m1'));
    expect(JSON.stringify(mixed)).toBe(before);
  });
});
