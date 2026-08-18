import { P2PChallengeLink } from './P2PChallengeLink';
import type { SpeciesId } from '../scene/PlayableCharacter';

export interface RemoteHello {
  species: SpeciesId;
  skinId: string;
}

/** The manual-code exchange screen for a throne-claim duel — real WebRTC, no backend, no
 * matchmaking server: "current king" is inherently a LOCAL fact (each player's own encrypted
 * save says whether THEY are king), not a globally synchronized one, since there is no shared
 * authority to synchronize it against without a backend. Any two players who want to duel just
 * exchange these two short codes (over chat, a call, however they already talk) and connect
 * directly; whoever wins applies the result to their own local save + leaderboard. This is the
 * honest shape of "P2P only, no backend" — not a compromise, the actual constraint made explicit
 * in the UI rather than silently pretended away. */
export class ChallengeGate {
  private root: HTMLDivElement;
  private hostBtn: HTMLButtonElement;
  private joinBtn: HTMLButtonElement;
  private offerOutEl: HTMLTextAreaElement;
  private offerInEl: HTMLTextAreaElement;
  private answerOutEl: HTMLTextAreaElement;
  private answerInEl: HTMLTextAreaElement;
  private applyAnswerBtn: HTMLButtonElement;
  private createAnswerBtn: HTMLButtonElement;
  private statusEl: HTMLDivElement;
  private cancelBtn: HTMLButtonElement;

  private resolveConnected: ((result: { link: P2PChallengeLink; remote: RemoteHello }) => void) | null = null;
  private rejectCanceled: (() => void) | null = null;
  private localInfo: RemoteHello;

  constructor(container: HTMLElement, localInfo: RemoteHello) {
    this.localInfo = localInfo;
    this.root = document.createElement('div');
    this.root.className = 'rw-challenge-gate';
    this.root.innerHTML = `
      <style>
        .rw-challenge-gate {
          position: fixed; inset: 0; z-index: 110;
          display: flex; align-items: center; justify-content: center;
          background: rgba(5,8,6,0.92);
          font-family: var(--body-face, ui-sans-serif, system-ui, sans-serif);
          color: var(--parchment, #eef2e6);
        }
        .rw-cg-panel {
          display: flex; flex-direction: column; gap: 12px; width: min(520px, 90vw);
          padding: 24px; background: rgba(14,10,8,0.9); border: 1px solid rgba(255,177,94,0.3);
          border-radius: 10px;
        }
        .rw-cg-title { font-family: var(--display-face, ui-serif, Georgia, serif); font-size: 22px; text-align: center; }
        .rw-cg-row { display: flex; gap: 10px; justify-content: center; }
        .rw-cg-btn {
          padding: 10px 20px; border-radius: 6px; cursor: pointer; border: 1px solid rgba(238,242,230,0.3);
          background: transparent; color: var(--parchment, #eef2e6); font-size: 14px;
        }
        .rw-cg-btn:hover { background: rgba(238,242,230,0.08); }
        .rw-cg-btn.rw-cg-primary { background: var(--spirit-amber, #ffb15e); color: #14100a; border: none; }
        .rw-cg-field { display: none; flex-direction: column; gap: 6px; }
        .rw-cg-field.rw-cg-active { display: flex; }
        .rw-cg-label { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.08em; }
        .rw-cg-code { width: 100%; height: 64px; font-family: var(--mono-face, monospace); font-size: 10px; resize: none; background: rgba(0,0,0,0.4); color: var(--parchment, #eef2e6); border: 1px solid rgba(238,242,230,0.2); border-radius: 4px; padding: 6px; }
        .rw-cg-status { font-size: 12px; opacity: 0.8; text-align: center; min-height: 16px; }
      </style>
      <div class="rw-cg-panel">
        <div class="rw-cg-title">Claim the Throne — Real Duel</div>
        <div class="rw-cg-row">
          <button class="rw-cg-btn rw-cg-primary rw-cg-host" type="button">Host a Challenge</button>
          <button class="rw-cg-btn rw-cg-join" type="button">Join a Challenge</button>
          <button class="rw-cg-btn rw-cg-cancel" type="button">Cancel</button>
        </div>

        <div class="rw-cg-field rw-cg-offer-out">
          <div class="rw-cg-label">Your challenge code — send this to your opponent</div>
          <textarea class="rw-cg-code rw-cg-offer-out-text" readonly></textarea>
          <div class="rw-cg-label">Paste their answer code here</div>
          <textarea class="rw-cg-code rw-cg-answer-in-text"></textarea>
          <button class="rw-cg-btn rw-cg-primary rw-cg-apply-answer" type="button">Connect</button>
        </div>

        <div class="rw-cg-field rw-cg-offer-in">
          <div class="rw-cg-label">Paste the challenge code you received</div>
          <textarea class="rw-cg-code rw-cg-offer-in-text"></textarea>
          <button class="rw-cg-btn rw-cg-primary rw-cg-create-answer" type="button">Generate Answer</button>
          <div class="rw-cg-label rw-cg-answer-out-label" style="display:none">Your answer code — send this back</div>
          <textarea class="rw-cg-code rw-cg-answer-out-text" readonly style="display:none"></textarea>
        </div>

        <div class="rw-cg-status"></div>
      </div>
    `;
    container.appendChild(this.root);

    this.hostBtn = this.root.querySelector('.rw-cg-host')!;
    this.joinBtn = this.root.querySelector('.rw-cg-join')!;
    this.cancelBtn = this.root.querySelector('.rw-cg-cancel')!;
    this.offerOutEl = this.root.querySelector('.rw-cg-offer-out-text')!;
    this.offerInEl = this.root.querySelector('.rw-cg-offer-in-text')!;
    this.answerOutEl = this.root.querySelector('.rw-cg-answer-out-text')!;
    this.answerInEl = this.root.querySelector('.rw-cg-answer-in-text')!;
    this.applyAnswerBtn = this.root.querySelector('.rw-cg-apply-answer')!;
    this.createAnswerBtn = this.root.querySelector('.rw-cg-create-answer')!;
    this.statusEl = this.root.querySelector('.rw-cg-status')!;

    this.hostBtn.addEventListener('click', () => this.startHost());
    this.joinBtn.addEventListener('click', () => this.showJoinField());
    this.applyAnswerBtn.addEventListener('click', () => this.applyAnswer());
    this.createAnswerBtn.addEventListener('click', () => this.createAnswer());
    this.cancelBtn.addEventListener('click', () => this.cancel());
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  private async startHost(): Promise<void> {
    this.root.querySelector('.rw-cg-offer-out')!.classList.add('rw-cg-active');
    this.setStatus('Generating your challenge code…');
    try {
      const { link, offerCode } = await P2PChallengeLink.createHost();
      this.offerOutEl.value = offerCode;
      this.setStatus('Send the code above to your opponent, then paste their answer below.');
      this.wireHandshake(link);
    } catch {
      this.setStatus('Could not start hosting — try again.');
    }
  }

  private showJoinField(): void {
    this.root.querySelector('.rw-cg-offer-in')!.classList.add('rw-cg-active');
  }

  private async createAnswer(): Promise<void> {
    const offerCode = this.offerInEl.value.trim();
    if (!offerCode) return;
    this.setStatus('Connecting…');
    try {
      const { link, answerCode } = await P2PChallengeLink.createGuest(offerCode);
      this.answerOutEl.value = answerCode;
      this.answerOutEl.style.display = 'block';
      (this.root.querySelector('.rw-cg-answer-out-label') as HTMLElement).style.display = 'block';
      this.setStatus('Send the answer code above back to the host.');
      this.wireHandshake(link);
    } catch {
      this.setStatus('That challenge code looks invalid — check it and try again.');
    }
  }

  private async applyAnswer(): Promise<void> {
    // Only reachable from the host flow — this.pendingHostLink is set by wireHandshake's host branch.
    const answerCode = this.answerInEl.value.trim();
    if (!answerCode || !this.pendingHostLink) return;
    try {
      await this.pendingHostLink.applyAnswerCode(answerCode);
      this.setStatus('Connecting…');
    } catch {
      this.setStatus('That answer code looks invalid — check it and try again.');
    }
  }

  private pendingHostLink: P2PChallengeLink | null = null;
  // Tracks whichever link is currently mid-handshake, host OR guest — cancel() needs this
  // regardless of role. pendingHostLink stays separate (only the host role reads it back, to
  // apply the answer code), this field exists purely for real cleanup on cancel.
  private activeLink: P2PChallengeLink | null = null;

  private wireHandshake(link: P2PChallengeLink): void {
    if (link.role === 'host') this.pendingHostLink = link;
    this.activeLink = link;
    link.onOpen(() => {
      this.setStatus('Connected — exchanging fighters…');
      link.send({ type: 'hello', species: this.localInfo.species, skinId: this.localInfo.skinId });
    });
    link.onMessage((data) => {
      const msg = data as { type: string; species?: SpeciesId; skinId?: string };
      if (msg.type === 'hello' && msg.species && msg.skinId) {
        this.root.remove();
        this.resolveConnected?.({ link, remote: { species: msg.species, skinId: msg.skinId } });
      }
    });
    link.onClose(() => {
      this.setStatus('Connection lost.');
    });
  }

  private cancel(): void {
    // Real cleanup — "Host a Challenge"/"Generate Answer" both create a real RTCPeerConnection
    // immediately, before the handshake completes. Without this, canceling (or canceling and
    // retrying repeatedly) left each of those connections open and connecting forever.
    this.activeLink?.close();
    this.root.remove();
    this.rejectCanceled?.();
  }

  whenConnected(): Promise<{ link: P2PChallengeLink; remote: RemoteHello }> {
    return new Promise((resolve, reject) => {
      this.resolveConnected = resolve;
      this.rejectCanceled = () => reject(new Error('canceled'));
    });
  }
}
