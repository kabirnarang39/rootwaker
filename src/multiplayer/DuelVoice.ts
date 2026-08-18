import type { P2PChallengeLink } from './P2PChallengeLink';

/** Real 1:1 voice, scoped to the two duel participants only — the same real-time constraint as
 * DuelChat: whoever you're fighting is who you'd be talking to, so this rides the SAME
 * RTCPeerConnection the duel's data channel already opened (see P2PChallengeLink's renegotiate())
 * rather than a separate mesh call system. A real getUserMedia mic permission prompt is
 * unavoidable browser security — start() resolves quietly without audio if the player denies it
 * or has no microphone, so a duel is never blocked on voice working. */
export class DuelVoice {
  private link: P2PChallengeLink;
  private localStream: MediaStream | null = null;
  private muted = false;
  private remoteStreamHandlers: Array<(stream: MediaStream) => void> = [];

  constructor(link: P2PChallengeLink) {
    this.link = link;
    this.link.onRemoteTrack((stream) => this.remoteStreamHandlers.forEach((h) => h(stream)));
  }

  async start(): Promise<boolean> {
    if (this.localStream) return true;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false; // permission denied / no mic — duel continues without voice
    }
    this.link.addMicTrack(this.localStream);
    return true;
  }

  /** Returns the new muted state. Real mute: disables the outgoing track rather than stopping
   * it, so un-muting doesn't need a second permission prompt or renegotiation. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.localStream?.getAudioTracks().forEach((track) => (track.enabled = !this.muted));
    return this.muted;
  }

  onRemoteStream(handler: (stream: MediaStream) => void): void {
    this.remoteStreamHandlers.push(handler);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get isActive(): boolean {
    return this.localStream !== null;
  }

  stop(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }
}
