import { ChatPanel } from './components/ChatPanel/ChatPanel';
import { JoinScreen } from './components/JoinScreen/JoinScreen';
import { useChatSession } from './hooks/useChatSession';
import type { SessionErrorReason } from './model/types';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:3001';

/**
 * The wording lives here, not in the transport. A participant sees this text and
 * never a raw socket error such as xhr poll error.
 */
function errorText(reason: SessionErrorReason): string {
  switch (reason) {
    case 'server-unreachable':
      return 'Cannot reach the chat server. Check that it is running, then try again.';
    case 'join-rejected':
      return 'The session could not be joined with that name. Try another one.';
  }
}

export function ChatFeature() {
  const session = useChatSession(SIGNALING_URL);

  if (session.status === 'idle' || session.status === 'connecting' || session.status === 'error') {
    return (
      <JoinScreen
        onJoin={(displayName) => {
          void session.join(displayName);
        }}
        isJoining={session.status === 'connecting'}
        connectionError={session.errorReason === null ? null : errorText(session.errorReason)}
      />
    );
  }

  return (
    <ChatPanel
      status={session.status}
      participants={session.participants}
      connectingIds={session.connectingIds}
      timeline={session.timeline}
      readiness={session.readiness}
      localParticipantId={session.localParticipantId}
      onSend={session.sendMessage}
      onEdit={session.editMessage}
      onDelete={session.deleteMessage}
      onLeave={session.leave}
    />
  );
}
