import { describe, expect, it, test } from 'vitest';
import {
  parseChatEvent,
  parsePeerEvent,
  serializeChatEvent,
  serializeTypingEvent,
  type ChatEvent,
} from './protocol';
import { MAX_DISPLAY_NAME_LENGTH, MAX_MESSAGE_LENGTH } from '../model/constants';

const created: ChatEvent = {
  type: 'message:create',
  payload: {
    messageId: 'm1',
    authorId: 'a1',
    authorName: 'Alex',
    text: 'Morning, standup in five.',
    createdAt: '2026-08-29T09:15:04.812Z',
  },
};

const updated: ChatEvent = {
  type: 'message:update',
  payload: {
    messageId: 'm1',
    authorId: 'a1',
    text: 'Morning, standup in ten.',
    editedAt: '2026-08-29T09:15:41.006Z',
  },
};

const deleted: ChatEvent = {
  type: 'message:delete',
  payload: {
    messageId: 'm1',
    authorId: 'a1',
    deletedAt: '2026-08-29T09:16:02.447Z',
  },
};

/** Builds a create event with one field replaced, to test a single rule at a time. */
function createWith(changes: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'message:create',
    payload: { ...created.payload, ...changes },
  });
}

describe('serializeChatEvent and parseChatEvent', () => {
  it('round-trips every chat event', () => {
    for (const event of [created, updated, deleted]) {
      expect(parseChatEvent(serializeChatEvent(event))).toEqual(event);
    }
  });
});

describe('parseChatEvent rejects bad input', () => {
  it('rejects invalid JSON', () => {
    expect(parseChatEvent('{not json')).toBeNull();
  });

  it('rejects JSON that is not an object', () => {
    expect(parseChatEvent('"hello"')).toBeNull();
    expect(parseChatEvent('42')).toBeNull();
    expect(parseChatEvent('null')).toBeNull();
    expect(parseChatEvent('[]')).toBeNull();
  });

  it('rejects an unknown event type', () => {
    expect(parseChatEvent('{"type":"message:burn","payload":{}}')).toBeNull();
  });

  it('rejects a missing payload', () => {
    expect(parseChatEvent('{"type":"message:create"}')).toBeNull();
  });

  it('rejects a missing required field on create', () => {
    for (const field of ['messageId', 'authorId', 'authorName', 'text', 'createdAt']) {
      const payload: Record<string, unknown> = { ...created.payload };
      delete payload[field];
      expect(parseChatEvent(JSON.stringify({ type: 'message:create', payload }))).toBeNull();
    }
  });

  it('rejects a missing required field on update', () => {
    for (const field of ['messageId', 'authorId', 'text', 'editedAt']) {
      const payload: Record<string, unknown> = { ...updated.payload };
      delete payload[field];
      expect(parseChatEvent(JSON.stringify({ type: 'message:update', payload }))).toBeNull();
    }
  });

  it('rejects a missing required field on delete', () => {
    for (const field of ['messageId', 'authorId', 'deletedAt']) {
      const payload: Record<string, unknown> = { ...deleted.payload };
      delete payload[field];
      expect(parseChatEvent(JSON.stringify({ type: 'message:delete', payload }))).toBeNull();
    }
  });

  it('rejects a field of the wrong type', () => {
    expect(parseChatEvent(createWith({ text: 42 }))).toBeNull();
    expect(parseChatEvent(createWith({ messageId: null }))).toBeNull();
  });

  it('rejects empty text on create and on update', () => {
    expect(parseChatEvent(createWith({ text: '' }))).toBeNull();
    expect(parseChatEvent(createWith({ text: '   ' }))).toBeNull();

    const payload = { ...updated.payload, text: '   ' };
    expect(parseChatEvent(JSON.stringify({ type: 'message:update', payload }))).toBeNull();
  });

  it('rejects oversized text on create and on update', () => {
    const tooLong = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);
    expect(parseChatEvent(createWith({ text: tooLong }))).toBeNull();

    const payload = { ...updated.payload, text: tooLong };
    expect(parseChatEvent(JSON.stringify({ type: 'message:update', payload }))).toBeNull();
  });

  it('accepts text at exactly the limit', () => {
    const parsed = parseChatEvent(createWith({ text: 'x'.repeat(MAX_MESSAGE_LENGTH) }));
    expect(parsed?.type).toBe('message:create');
  });

  it('rejects an invalid timestamp', () => {
    expect(parseChatEvent(createWith({ createdAt: 'not-a-date' }))).toBeNull();
    expect(parseChatEvent(createWith({ createdAt: 1234 }))).toBeNull();
  });

  it('rejects an oversized author name', () => {
    const tooLong = 'n'.repeat(MAX_DISPLAY_NAME_LENGTH + 1);
    expect(parseChatEvent(createWith({ authorName: tooLong }))).toBeNull();
  });
});

describe('parseChatEvent normalises text', () => {
  it('trims surrounding whitespace', () => {
    const parsed = parseChatEvent(createWith({ text: '  hello  ' }));
    expect(parsed?.type === 'message:create' && parsed.payload.text).toBe('hello');
  });
});

describe('typing events', () => {
  test('a valid typing event round-trips', () => {
    const raw = serializeTypingEvent({
      type: 'typing:changed',
      payload: { participantId: 'p-alex', isTyping: true },
    });

    expect(parsePeerEvent(raw)).toEqual({
      type: 'typing:changed',
      payload: { participantId: 'p-alex', isTyping: true },
    });
  });

  test('isTyping must be a boolean, not a truthy value', () => {
    for (const isTyping of ['true', 1, null, undefined]) {
      const raw = JSON.stringify({
        type: 'typing:changed',
        payload: { participantId: 'p-alex', isTyping },
      });
      expect(parsePeerEvent(raw)).toBeNull();
    }
  });

  test('a typing event without a participant is rejected', () => {
    const raw = JSON.stringify({ type: 'typing:changed', payload: { isTyping: true } });

    expect(parsePeerEvent(raw)).toBeNull();
  });

  test('parseChatEvent never returns a typing event', () => {
    const raw = serializeTypingEvent({
      type: 'typing:changed',
      payload: { participantId: 'p-alex', isTyping: true },
    });

    expect(parsePeerEvent(raw)).not.toBeNull();
    expect(parseChatEvent(raw)).toBeNull();
  });
});
