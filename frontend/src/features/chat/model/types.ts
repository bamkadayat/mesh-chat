/** How the connection to the signaling server is doing. */
export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Whether a message can reach every peer right now.
 * Separate from SessionStatus: being in the room does not mean the channel is open.
 */
export type ComposerReadiness = 'waiting' | 'connecting' | 'open' | 'failed';

export type ChatMessage = {
  messageId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  /** Set when the author edits. Shows the edited label. */
  editedAt: string | null;
  /** Set when the author deletes. The message stays, shown as deleted. */
  deletedAt: string | null;
};

/** Join and leave notices. Built locally, never sent to peers. */
export type SystemEvent = {
  eventId: string;
  type: 'participant-joined' | 'participant-left';
  displayName: string;
  occurredAt: string;
};

export type TimelineItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'system'; event: SystemEvent };

/**
 * Messages and system events in one list, in the order they arrived.
 * Edits and deletes change an item where it is, so nothing moves.
 */
export type ChatState = {
  timeline: TimelineItem[];
};
