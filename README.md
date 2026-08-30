# Mesh Chat

Real-time peer-to-peer chat for small groups. Messages travel directly between
browsers over WebRTC DataChannels. A small Socket.IO server handles signaling
and presence only.

## Getting Started

Requires Node.js 22+, pnpm 9+, and a modern browser with WebRTC support.

```bash
pnpm install
pnpm dev
```

The client runs at <http://localhost:5173>. The signaling server runs on port
3001. Open the app in two or more browser windows to join the same room and
send messages between participants.

Useful checks:

```bash
pnpm build
pnpm lint
pnpm check
```

## Tests

The project has unit tests for the frontend, server, chat protocol, and chat
state reducer. It also has a Playwright end-to-end test that opens two real
browser participants and checks the full chat flow: join, connect, send, edit,
delete, and leave.

```bash
pnpm test
pnpm test:frontend
pnpm test:server
pnpm test:e2e
```

## Configuration

The app works without a `.env` file. Copy `.env.example` to `.env` only if you
want to change the defaults:

```dotenv
VITE_SIGNALING_URL=http://localhost:3001
CLIENT_ORIGIN=http://localhost:5173
PORT=3001
```

`VITE_` variables are included in the client bundle, so they should not contain
secrets.

## Architecture: Option B, Peer-to-Peer

This project uses Option B: peer-to-peer chat with WebRTC DataChannels.

The browser sends chat messages directly to the other browsers in the room. The
server does not handle chat messages. It tracks who is in the room and forwards
the signaling events peers need in order to connect.

What the server receives:

```text
room:join              join the room, and get the current roster back
webrtc:offer           forward this offer to one named participant
webrtc:answer          forward this answer to one named participant
webrtc:ice-candidate   forward this candidate to one named participant
disconnect             the socket closed
```

What the server sends:

```text
participant:joined     to everyone already in the room
participant:left       to the room when a socket closes
webrtc:offer           to the one participant it is addressed to
webrtc:answer          to the one participant it is addressed to
webrtc:ice-candidate   to the one participant it is addressed to
```

Before forwarding anything, the server checks that the sender is the participant
the payload claims to be, and that both participants are in the same room.

I chose peer-to-peer because the main work in this exercise is real-time browser
communication. This design keeps the server small and makes the WebRTC flow
visible: offers, answers, ICE candidates, connection readiness, and DataChannel
messages.

In practice, each browser connects to every other participant. With `n`
participants, each browser holds `n - 1` peer connections. That fits small
standup-style rooms better than large public rooms.

## Message Protocol

Chat events are JSON strings sent over the WebRTC DataChannel. There are three
message events:

```json
{
  "type": "message:create",
  "payload": {
    "messageId": "0f5b7a6c-9f1e-4a3e-9c1c-2f0a5a1d7b3e",
    "authorId": "a1c4d0f2-6b7e-4c58-9a2b-13d6f8e0c5a7",
    "authorName": "Alex Fisher",
    "text": "Morning, standup in five.",
    "createdAt": "2026-08-29T09:15:04.812Z"
  }
}
```

```json
{
  "type": "message:update",
  "payload": {
    "messageId": "0f5b7a6c-9f1e-4a3e-9c1c-2f0a5a1d7b3e",
    "authorId": "a1c4d0f2-6b7e-4c58-9a2b-13d6f8e0c5a7",
    "text": "Morning, standup in ten.",
    "editedAt": "2026-08-29T09:15:41.006Z"
  }
}
```

```json
{
  "type": "message:delete",
  "payload": {
    "messageId": "0f5b7a6c-9f1e-4a3e-9c1c-2f0a5a1d7b3e",
    "authorId": "a1c4d0f2-6b7e-4c58-9a2b-13d6f8e0c5a7",
    "deletedAt": "2026-08-29T09:16:02.447Z"
  }
}
```

Important rules:

- `messageId` identifies the message across create, edit, and delete events.
- Only the original author can edit or delete a message.
- Deleted messages stay in the timeline as a "Message deleted" notice.
- Malformed events are ignored instead of throwing.
- Message text is rendered as text, not HTML.

## Project Structure

```text
frontend/src/
  app/              application shell
  features/chat/    chat UI, state, protocol, signaling, and WebRTC
  lib/              shared frontend utilities
  styles/           global styles

server/src/
  config/           environment config
  rooms/            in-memory room and presence state
  signaling/        Socket.IO handlers and payload validation

shared/             signaling contracts used by frontend and server
```

## Edge Cases

### A participant disconnects and reconnects

Handled. Socket.IO reconnects on its own and the client rejoins the room. The
roster from that rejoin is authoritative: anyone who left during the outage is
gone, and anyone who arrived is there.

All peer connections are rebuilt after a rejoin. A channel that survived the
outage looks the same as one that did not, so the client does not try to tell
them apart.

Tested by restarting the signaling server with three participants connected. All
three channels reopened and all three pairs could send messages again.

Closing a window is the simpler case. The server sees the socket close and sends
`participant:left` to the room.

### A new participant joins, do they see message history?

No. This is a deliberate limit, not a missing feature. The server stores nothing
and peers do not send a history snapshot, so a participant sees only the messages
sent after they join.

A page refresh has the same effect. You return to the join screen and your own
timeline is empty. Your participant ID stays in `sessionStorage`, and the other
windows still hold every message you sent.

A database would not be the right fix here, because the server would then have to
receive message content. The peer-to-peer fix is for an existing peer to send a
snapshot over the DataChannel. That needs rules for which peer answers and what
happens when two snapshots disagree, so it is left out.

### How does the UI handle a large volume of messages?

Measured with two participants, one of them sending continuously:

| messages | DOM nodes | list height | scroll to top | compose keystroke |
| --- | --- | --- | --- | --- |
| 200 | 201 | 18,142px | 0ms | 2ms |
| 500 | 501 | 45,255px | 0ms | 9ms |
| 1,000 | 1,001 | 90,442px | 0ms | 3ms |
| 2,000 | 2,001 | 180,817px | 0ms | 5ms |

There is no virtualization. The list keeps one DOM node per message, so it will
slow down at some point, but it had not at 2,000.

The list follows new messages only while you are near the bottom. Scrolling up to
read history stops it following, and scrolling back down resumes it.

That behaviour was worth testing. Under a fast burst the list stopped following
and never recovered. Auto-scrolling raises scroll events of its own, and during a
burst one of those can measure a distance against messages that arrived after it.
New messages and auto-scrolling never move the view up, so only an upward move now
stops the follow.
