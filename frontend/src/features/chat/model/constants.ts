/** Name of the data channel both peers open for chat. */
export const CHAT_CHANNEL_LABEL = 'chat';

/** Longest message we accept, checked when sending and when receiving. */
export const MAX_MESSAGE_LENGTH = 2000;

/** Longest display name the join screen accepts. */
export const MAX_DISPLAY_NAME_LENGTH = 32;

/** Stop telling peers you are typing after this much quiet. */
export const TYPING_IDLE_MS = 3000;

/**
 * Drop a peer's typing state if nothing refreshes it. Without this a lost
 * "stopped" event would leave someone typing forever.
 */
export const TYPING_EXPIRY_MS = 8000;
