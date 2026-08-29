# Mesh Chat

Real-time group chat for small sessions. Chat messages travel **directly between
browsers** over WebRTC DataChannels. A small Socket.IO server handles only signaling
and presence, and never sees message content.

## Getting started

Requires Node.js 22+, pnpm 9+, and a browser with WebRTC support.

```bash
pnpm install
pnpm dev
```

The client runs on <http://localhost:5173> and the signaling server on port 3001.
Open two or three windows to see the mesh form.

```bash
pnpm build   # tsc -b for both projects, then the Vite client build
pnpm lint
pnpm check   # lint + unit tests + build
```

### Configuration

The application runs with no `.env` at all. Copy `.env.example` to `.env` to change
the defaults:

```dotenv
VITE_SIGNALING_URL=http://localhost:3001
CLIENT_ORIGIN=http://localhost:5173
PORT=3001
```

`VITE_`-prefixed variables are inlined into the client bundle and are **not** secrets.

## Architecture

Peer-to-peer. Each browser holds a direct `RTCPeerConnection` to every other
participant, and chat events travel over an `RTCDataChannel` on each of those
connections. The server exists only to introduce peers to each other.

A server-relayed WebSocket design would also have been valid and simpler to reason
about. Peer-to-peer was chosen because it demonstrates real direct communication and
keeps the server deliberately small — at the cost of the mesh scaling limit described
below.

### Data flow

```text
  Browser A                    Signaling server                  Browser B
  ─────────                    ────────────────                  ─────────
      │   room:join                    │                              │
      ├───────────────────────────────►│                              │
      │◄──── ack: participant roster ──┤                              │
      │                                │──── participant:joined ─────►│
      │   webrtc:offer                 │                              │
      ├───────────────────────────────►│─────────────────────────────►│
      │                                │◄──────────── webrtc:answer ──┤
      │◄───────────────────────────────┤                              │
      │   webrtc:ice-candidate  (both directions, queued if early)    │
      │◄──────────────────────────────►│◄────────────────────────────►│
      │                                │                              │
      │  ═══════════ RTCDataChannel ═══════════════════════════════►  │
      │      message:create / message:update / message:delete         │
      │            (server sees none of this)                         │
```

### Signaling versus chat transport

These are two different channels and are never conflated:

| | Socket.IO | RTCDataChannel |
| --- | --- | --- |
| Carries | room join, presence, offers, answers, ICE | chat events only |
| Passes through the server | yes | **no** |
| Events | `room:join`, `participant:joined`, `participant:left`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate` | `message:create`, `message:update`, `message:delete` |

The signaling server has no message handler of any kind. The chat protocol lives in the
frontend and is not importable by the server — it is not in `shared/`.

### Why Socket.IO rather than a raw WebSocket

Presence correctness depends on knowing quickly and reliably when a participant is
gone. Socket.IO ships a heartbeat, disconnect detection and reconnection with backoff;
building those on `ws` would have meant writing ping/pong timers, liveness timeouts and
a reconnect loop before any feature work started. It is used **only** for signaling.

### Module boundaries

```text
frontend/  React, chat protocol, WebRTC        ─┐
server/    signaling and room management       ─┼─ both import shared/
shared/    signaling contracts only            ─┘   never each other
```

Inside the client, everything belonging to the chat domain lives under
`frontend/src/features/chat/`, split into `components/ hooks/ model/ protocol/ rtc/
signaling/`. The nesting is deliberate: it keeps `app/`, `lib/` and `styles/` free of
chat concerns, so the domain boundary is visible in the file tree rather than upheld by
convention, and the transport, protocol and state layers are separated by location.

`peerMesh` owns connections, channels and ICE, and transports **opaque strings**. It
never imports or parses the chat protocol. It surfaces received data through an
`onMessage` callback carrying the source peer ID and the raw string; `useChatSession`
calls `parseChatEvent(raw)`, discards `null` results and dispatches the rest to the
reducer. Keeping the transport ignorant of its payload is what makes the protocol
testable without WebRTC.

## Message protocol

Three events, sent as JSON strings over the DataChannel. Every event identifies the
message by `messageId`, including creation.

```json
{
  "type": "message:create",
  "payload": {
    "messageId": "0f5b7a6c-9f1e-4a3e-9c1c-2f0a5a1d7b3e",
    "authorId": "a1c4d0f2-6b7e-4c58-9a2b-13d6f8e0c5a7",
    "authorName": "Alex",
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

Rules that matter for correctness:

- **Creation is idempotent by `messageId`.** The author applies its own event locally
  and also broadcasts it, so a duplicate is normal rather than exceptional.
- **Ownership is checked against the stored original author**, never against the
  incoming event alone. An edit or delete claiming someone else's `authorId` is ignored.
- **Deletion leaves a tombstone.** The timeline item stays so other participants can see
  that a deletion happened.
- **Peer data is untrusted.** Parsing returns `null` on malformed input rather than
  throwing, so a bad frame cannot take down a render.
- Text is never rendered as HTML. URLs are tokenised and rendered as React anchors —
  no `dangerouslySetInnerHTML` anywhere.

## Trade-offs

- **Full mesh over an SFU or a relay.** Simple and genuinely peer-to-peer, but every
  participant holds a connection to every other. With `n` participants there are
  `n * (n - 1) / 2` connections — fine for a handful, not intended for large rooms.
- **No global message ordering.** Each DataChannel is reliable and ordered per pair, but
  several senders give no single authoritative order. Messages appear in local arrival
  order; no distributed ordering algorithm is implemented.
- **Client-asserted identity.** Ownership checks are an application rule, not security.
  A modified client could claim another participant's ID. There is no authentication.
- **No TURN.** Where a direct path cannot be negotiated — symmetric NAT, restrictive
  corporate firewalls — there is no relay fallback and the connection fails. Reliable on
  a LAN and on many home networks; not guaranteed on an arbitrary network.
- **No history for late joiners.** A participant sees only messages sent after they
  join. The server stores nothing and peers send no snapshot.

## Deliberate omissions

- **No Docker.** `pnpm dev` already starts both required processes with one command, so
  a container adds a build step without removing one.
- **Attachment and emoji buttons are visibly disabled.** They appear in the design
  mockup, but the underlying features are unimplemented bonuses. Rendering them as
  disabled native buttons with accessible names such as `Attach files (not available)`
  matches the design without pretending the features exist.
- **No CI, authentication, history sync, typing indicators, read receipts, unread
  badges or link previews.** All are out of scope for this exercise.
