import type { P2PChallengeLink } from './P2PChallengeLink';

export interface ChatMessage {
  from: 'me' | 'opponent';
  text: string;
  at: number; // Date.now()
}

const MAX_CHAT_LEN = 200;

/** Real live text chat scoped to the two duel participants only, riding the SAME
 * RTCPeerConnection/data channel P2PChallengeLink already opened for the fight — no separate
 * channel, no world-mesh broadcast. Chat during a duel is inherently 1:1 (whoever you're
 * fighting is who you're talking to), so this reuses the existing connection instead of building
 * mesh chat infrastructure for something that never needs more than two participants. Ephemeral
 * by design — a duel-side conversation, gone when the duel ends, not a persisted CRDT log like
 * the world leaderboard (there's no "everyone's chat history" here to converge on). */
export class DuelChat {
  private link: P2PChallengeLink;
  private messages: ChatMessage[] = [];
  private handlers: Array<(messages: ChatMessage[]) => void> = [];

  constructor(link: P2PChallengeLink) {
    this.link = link;
    this.link.onMessage((data) => {
      const msg = data as { type?: string; text?: string };
      if (msg.type !== 'chat' || typeof msg.text !== 'string') return;
      this.messages.push({ from: 'opponent', text: msg.text.slice(0, MAX_CHAT_LEN), at: Date.now() });
      this.handlers.forEach((h) => h(this.messages));
    });
  }

  send(text: string): void {
    const trimmed = text.trim().slice(0, MAX_CHAT_LEN);
    if (!trimmed) return;
    this.link.send({ type: 'chat', text: trimmed });
    this.messages.push({ from: 'me', text: trimmed, at: Date.now() });
    this.handlers.forEach((h) => h(this.messages));
  }

  onUpdate(handler: (messages: ChatMessage[]) => void): void {
    this.handlers.push(handler);
  }

  get history(): ChatMessage[] {
    return this.messages;
  }
}
