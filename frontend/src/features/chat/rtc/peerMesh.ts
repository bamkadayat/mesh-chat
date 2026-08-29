import type {
  IceCandidate,
  SessionDescription,
} from '../../../../../shared/signalingEvents';
import { CHAT_CHANNEL_LABEL } from '../model/constants';

/** Public STUN server used to discover network-facing candidates across NAT. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export type ChannelState = 'connecting' | 'open' | 'failed';

/** Whatever arrived on the channel, still a string. This layer never reads it. */
export type PeerMessage = {
  sourcePeerId: string;
  raw: string;
};

export type PeerMeshCallbacks = {
  onMessage: (message: PeerMessage) => void;
  onChannelStateChange: (peerId: string, state: ChannelState) => void;
  onLocalDescription: (peerId: string, description: SessionDescription) => void;
  onLocalIceCandidate: (peerId: string, candidate: IceCandidate) => void;
};

export type PeerMesh = {
  connectToPeer: (peerId: string) => Promise<void>;
  handleOffer: (peerId: string, description: SessionDescription) => Promise<void>;
  handleAnswer: (peerId: string, description: SessionDescription) => Promise<void>;
  handleIceCandidate: (peerId: string, candidate: IceCandidate) => Promise<void>;
  broadcast: (raw: string) => void;
  removePeer: (peerId: string) => void;
  close: () => void;
};

type Peer = {
  connection: RTCPeerConnection;
  channel: RTCDataChannel | null;
  /** ICE candidates that arrived before this peer had a remote description. */
  pendingCandidates: IceCandidate[];
};

/**
 * Owns the peer connections and their data channels. It moves strings and knows
 * nothing about what they mean, which is why the chat protocol is not imported here.
 */
export function createPeerMesh(callbacks: PeerMeshCallbacks): PeerMesh {
  const peers = new Map<string, Peer>();
  let closed = false;

  /** A peer removed or replaced must stop reporting, or it revives dead state. */
  function isCurrentPeer(peerId: string, peer: Peer): boolean {
    return !closed && peers.get(peerId) === peer;
  }

  function ensurePeer(peerId: string): Peer {
    const existing = peers.get(peerId);
    if (existing !== undefined) {
      return existing;
    }

    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { connection, channel: null, pendingCandidates: [] };
    peers.set(peerId, peer);

    connection.onicecandidate = ({ candidate }) => {
      if (candidate !== null) {
        callbacks.onLocalIceCandidate(peerId, {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
        });
      }
    };

    /** The answerer never creates a channel; it receives the offerer's. */
    connection.ondatachannel = ({ channel }) => {
      attachChannel(peerId, peer, channel);
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed' && isCurrentPeer(peerId, peer)) {
        callbacks.onChannelStateChange(peerId, 'failed');
      }
    };

    /** Unguarded on purpose: this peer was just put in the map, so it is current. */
    callbacks.onChannelStateChange(peerId, 'connecting');
    return peer;
  }

  function attachChannel(peerId: string, peer: Peer, channel: RTCDataChannel): void {
    peer.channel = channel;

    channel.onopen = () => {
      if (isCurrentPeer(peerId, peer)) {
        callbacks.onChannelStateChange(peerId, 'open');
      }
    };

    channel.onerror = () => {
      if (isCurrentPeer(peerId, peer)) {
        callbacks.onChannelStateChange(peerId, 'failed');
      }
    };

    /** Without this the state stays open and the composer keeps accepting sends. */
    channel.onclose = () => {
      if (isCurrentPeer(peerId, peer)) {
        callbacks.onChannelStateChange(peerId, 'failed');
      }
    };

    /** Binary is never sent, so anything that is not a string is ignored. */
    channel.onmessage = ({ data }) => {
      if (isCurrentPeer(peerId, peer) && typeof data === 'string') {
        callbacks.onMessage({ sourcePeerId: peerId, raw: data });
      }
    };
  }

  /**
   * A failed negotiation must surface as state, never as an unhandled rejection.
   * An await can settle after removePeer, so a stale failure is dropped.
   */
  function reportFailure(peerId: string, peer: Peer, error: unknown): void {
    if (!isCurrentPeer(peerId, peer)) {
      return;
    }

    console.error(`peer ${peerId} negotiation failed`, error);
    callbacks.onChannelStateChange(peerId, 'failed');
  }

  async function applyPendingCandidates(peer: Peer): Promise<void> {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];

    for (const candidate of queued) {
      await peer.connection.addIceCandidate(candidate);
    }
  }

  return {
    /** Only the newcomer calls this, which is what avoids two offers crossing. */
    async connectToPeer(peerId) {
      if (closed) {
        return;
      }

      const peer = ensurePeer(peerId);
      try {
        if (peer.channel === null) {
          attachChannel(peerId, peer, peer.connection.createDataChannel(CHAT_CHANNEL_LABEL));
        }
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);
        callbacks.onLocalDescription(peerId, { type: 'offer', sdp: offer.sdp });
      } catch (error) {
        reportFailure(peerId, peer, error);
      }
    },

    async handleOffer(peerId, description) {
      if (closed) {
        return;
      }

      const peer = ensurePeer(peerId);
      try {
        await peer.connection.setRemoteDescription(description);
        await applyPendingCandidates(peer);

        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        callbacks.onLocalDescription(peerId, { type: 'answer', sdp: answer.sdp });
      } catch (error) {
        reportFailure(peerId, peer, error);
      }
    },

    async handleAnswer(peerId, description) {
      const peer = peers.get(peerId);
      if (closed || peer === undefined) {
        return;
      }

      try {
        await peer.connection.setRemoteDescription(description);
        await applyPendingCandidates(peer);
      } catch (error) {
        reportFailure(peerId, peer, error);
      }
    },

    /**
     * ICE candidates often arrive before the offer or answer they belong to.
     * addIceCandidate throws without a remote description, so they wait.
     */
    async handleIceCandidate(peerId, candidate) {
      if (closed) {
        return;
      }

      const peer = ensurePeer(peerId);
      if (peer.connection.remoteDescription === null) {
        peer.pendingCandidates.push(candidate);
        return;
      }

      try {
        await peer.connection.addIceCandidate(candidate);
      } catch (error) {
        reportFailure(peerId, peer, error);
      }
    },

    broadcast(raw) {
      for (const peer of peers.values()) {
        if (peer.channel?.readyState === 'open') {
          peer.channel.send(raw);
        }
      }
    },

    /** Delete first, so the resulting onclose is not reported as a failure. */
    removePeer(peerId) {
      const peer = peers.get(peerId);
      if (peer === undefined) {
        return;
      }

      peers.delete(peerId);
      peer.channel?.close();
      peer.connection.close();
    },

    close() {
      closed = true;
      for (const peer of peers.values()) {
        peer.channel?.close();
        peer.connection.close();
      }
      peers.clear();
    },
  };
}
