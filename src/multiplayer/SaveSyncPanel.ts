import { SaveGame } from '../game/SaveGame';
import { shareSaveForSync, restoreSaveViaSync, type ShareHandle } from './SaveSyncSession';

/** The real, honest UI for moving progress between two browsers on the SAME distributed mesh the
 * world leaderboard/duels already use — see SaveSyncSession.ts's own doc comment for the actual
 * mechanics and its real limits (best-effort, needs the old browser open and sharing at the same
 * moment). Same manual-secret-exchange spirit as ChallengeGate.ts's duel codes — a passphrase
 * here instead of a copy-pasted offer/answer code, since trystero's own room-based discovery
 * means the two browsers find each other automatically once they share the same passphrase, no
 * code to copy at all. */
export class SaveSyncPanel {
  private root: HTMLDivElement;
  private passphraseInput: HTMLInputElement;
  private shareBtn: HTMLButtonElement;
  private restoreBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private statusEl: HTMLDivElement;
  private saveGame = new SaveGame();
  private shareHandle: ShareHandle | null = null;
  private resolveClose: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'rw-sync-gate';
    this.root.innerHTML = `
      <style>
        .rw-sync-gate {
          position: fixed; inset: 0; z-index: 110;
          display: flex; align-items: center; justify-content: center;
          background: rgba(5,8,6,0.92);
          font-family: var(--body-face, ui-sans-serif, system-ui, sans-serif);
          color: var(--parchment, #eef2e6);
        }
        .rw-sync-panel {
          display: flex; flex-direction: column; gap: 14px; width: min(440px, 90vw);
          padding: 24px; background: rgba(14,10,8,0.9); border: 1px solid rgba(255,177,94,0.3);
          border-radius: 10px;
        }
        .rw-sync-title { font-family: var(--display-face, ui-serif, Georgia, serif); font-size: 20px; text-align: center; }
        .rw-sync-blurb { font-size: 12px; opacity: 0.75; line-height: 1.5; text-align: center; }
        .rw-sync-label { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.08em; }
        .rw-sync-input {
          width: 100%; font: inherit; font-size: 14px; padding: 8px 10px;
          background: rgba(0,0,0,0.4); color: var(--parchment, #eef2e6);
          border: 1px solid rgba(238,242,230,0.2); border-radius: 4px;
        }
        .rw-sync-input:focus { outline: none; border-color: rgba(255,177,94,0.6); }
        .rw-sync-row { display: flex; gap: 10px; }
        .rw-sync-btn {
          flex: 1; padding: 10px 16px; border-radius: 6px; cursor: pointer;
          border: 1px solid rgba(238,242,230,0.3); background: transparent;
          color: var(--parchment, #eef2e6); font-size: 13px;
        }
        .rw-sync-btn:hover { background: rgba(238,242,230,0.08); }
        .rw-sync-btn.rw-sync-primary { background: var(--spirit-amber, #ffb15e); color: #14100a; border: none; }
        .rw-sync-status { font-size: 12px; opacity: 0.85; text-align: center; min-height: 32px; line-height: 1.5; }
        .rw-sync-cancel { background: transparent; border: none; color: var(--parchment, #eef2e6); opacity: 0.6; font-size: 12px; cursor: pointer; text-align: center; }
        .rw-sync-cancel:hover { opacity: 0.9; }
      </style>
      <div class="rw-sync-panel">
        <div class="rw-sync-title">Move Progress Between Browsers</div>
        <div class="rw-sync-blurb">
          No account, no server — this uses the same peer-to-peer mesh as the world leaderboard.
          Pick a passphrase, share it on your OLD browser, then restore it here. Both need to be
          open at the same time; this only works while a real peer is listening.
        </div>
        <div>
          <div class="rw-sync-label">Passphrase (same on both browsers)</div>
          <input class="rw-sync-input" type="text" autocomplete="off" placeholder="a phrase only you would know" />
        </div>
        <div class="rw-sync-row">
          <button class="rw-sync-btn rw-sync-share" type="button">Share From Here</button>
          <button class="rw-sync-btn rw-sync-primary rw-sync-restore" type="button">Restore Here</button>
        </div>
        <div class="rw-sync-status"></div>
        <button class="rw-sync-cancel" type="button">Close</button>
      </div>
    `;
    container.appendChild(this.root);

    this.passphraseInput = this.root.querySelector('.rw-sync-input')!;
    this.shareBtn = this.root.querySelector('.rw-sync-share')!;
    this.restoreBtn = this.root.querySelector('.rw-sync-restore')!;
    this.cancelBtn = this.root.querySelector('.rw-sync-cancel')!;
    this.statusEl = this.root.querySelector('.rw-sync-status')!;

    this.shareBtn.addEventListener('click', () => void this.share());
    this.restoreBtn.addEventListener('click', () => void this.restore());
    this.cancelBtn.addEventListener('click', () => this.close());
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  private async share(): Promise<void> {
    const passphrase = this.passphraseInput.value.trim();
    if (!passphrase) {
      this.setStatus('Enter a passphrase first — the other browser needs the exact same one.');
      return;
    }
    const save = await this.saveGame.load();
    if (!save) {
      this.setStatus("This browser has no real progress yet — there's nothing to share.");
      return;
    }
    this.shareHandle?.stop();
    this.setStatus('Sharing — keep this open. Go restore it on the other browser now.');
    this.shareHandle = await shareSaveForSync(passphrase, save);
  }

  private async restore(): Promise<void> {
    const passphrase = this.passphraseInput.value.trim();
    if (!passphrase) {
      this.setStatus('Enter a passphrase first — the same one you shared with on the other browser.');
      return;
    }
    this.setStatus('Looking for the other browser — make sure it has "Share From Here" open with the same passphrase…');
    const restored = await restoreSaveViaSync(passphrase);
    if (!restored) {
      this.setStatus('No response. Double-check the other browser is open, sharing, and using the exact same passphrase.');
      return;
    }
    await this.saveGame.save(restored);
    this.setStatus('Restored! Reloading to pick it up…');
    window.setTimeout(() => window.location.reload(), 1200);
  }

  private close(): void {
    this.shareHandle?.stop();
    this.root.remove();
    this.resolveClose?.();
  }

  whenClosed(): Promise<void> {
    return new Promise((resolve) => {
      this.resolveClose = resolve;
    });
  }
}
