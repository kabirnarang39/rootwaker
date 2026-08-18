// A public STUN server (Google's, free, no account) — standard for any WebRTC app to discover
// its own reachable network address, NOT a backend of ours: it never sees game data, never
// relays anything, and connection still fully fails if both peers are behind symmetric NATs with
// no relay (a real, honest limitation of pure P2P with no TURN relay server — acceptable here
// since a TURN server would itself be backend infrastructure we don't want to run).
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function encodeDescription(desc: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(desc));
}

function decodeDescription(code: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(code)) as RTCSessionDescriptionInit;
}

/** Resolves once ICE candidate gathering finishes. Required because there is no signaling
 * server here to trickle candidates over — the full SDP (including every gathered candidate)
 * must be baked into the one manually-copied offer/answer code, so gathering has to complete
 * before that code is generated. */
function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export type PeerRole = 'host' | 'guest';

/** A single bidirectional real-time channel between two browsers, connected entirely peer-to-
 * peer via WebRTC — no signaling server, no backend of any kind. The two peers exchange exactly
 * two short text codes by hand (copy/paste, over any channel the players already share — chat,
 * a call, whatever) to establish the connection: the host generates an offer code, the guest
 * turns it into an answer code, the host applies that answer code, and the data channel opens.
 * Once open, `send`/`onMessage` behave like a plain real-time socket for the duel session built
 * on top of this (see DuelSession.ts). */
export class P2PChallengeLink {
  readonly role: PeerRole;
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private messageHandlers: Array<(data: unknown) => void> = [];
  private openHandlers: Array<() => void> = [];
  private closeHandlers: Array<() => void> = [];

  private constructor(role: PeerRole) {
    this.role = role;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'closed' || this.pc.connectionState === 'failed') {
        this.closeHandlers.forEach((h) => h());
      }
    };
  }

  private wireChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => this.openHandlers.forEach((h) => h());
    channel.onclose = () => this.closeHandlers.forEach((h) => h());
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.messageHandlers.forEach((h) => h(data));
      } catch {
        // malformed message from a misbehaving/tampered peer — drop it, never trust or crash on
        // network input; every real consumer of onMessage must already validate its own shape.
      }
    };
  }

  /** Host side, step 1: creates the data channel and a real SDP offer, waits for ICE gathering
   * to finish, and returns the code to hand to the other player. */
  static async createHost(): Promise<{ link: P2PChallengeLink; offerCode: string }> {
    const link = new P2PChallengeLink('host');
    const channel = link.pc.createDataChannel('duel', { ordered: true });
    link.wireChannel(channel);
    const offer = await link.pc.createOffer();
    await link.pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(link.pc);
    return { link, offerCode: encodeDescription(link.pc.localDescription!) };
  }

  /** Host side, step 2: applies the answer code the guest generated. Resolves once the peer
   * connection has real ICE candidates set and the data channel can begin opening. */
  async applyAnswerCode(answerCode: string): Promise<void> {
    if (this.role !== 'host') throw new Error('applyAnswerCode is only valid on the host side');
    await this.pc.setRemoteDescription(decodeDescription(answerCode));
  }

  /** Guest side, the whole handshake in one call: takes the host's offer code, creates a real
   * SDP answer, waits for ICE gathering, and returns the code to hand back to the host. */
  static async createGuest(offerCode: string): Promise<{ link: P2PChallengeLink; answerCode: string }> {
    const link = new P2PChallengeLink('guest');
    link.pc.ondatachannel = (event) => link.wireChannel(event.channel);
    await link.pc.setRemoteDescription(decodeDescription(offerCode));
    const answer = await link.pc.createAnswer();
    await link.pc.setLocalDescription(answer);
    await waitForIceGatheringComplete(link.pc);
    return { link, answerCode: encodeDescription(link.pc.localDescription!) };
  }

  send(data: unknown): void {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(data));
  }

  onMessage(handler: (data: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  onOpen(handler: () => void): void {
    this.openHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  get isOpen(): boolean {
    return this.channel?.readyState === 'open';
  }

  close(): void {
    this.channel?.close();
    this.pc.close();
  }
}
