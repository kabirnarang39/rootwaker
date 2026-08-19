import { getDisplayName, setDisplayName } from '../multiplayer/DeviceIdentity';

/** The real landing screen this project never had — main.ts used to boot straight into either
 * ResumeGate or CharacterSelect, so a first-time player never saw the game's own name, and there
 * was no moment/place to give a player a real, chosen display name (getDisplayName() only ever
 * returned an auto-generated placeholder like "Swift Mongoose #482" — that name IS already shown
 * on the world leaderboard and coronation results, see HUD.ts's own `${playerName} · ${species}`
 * label, so the missing piece was purely "a player can never actually set it").
 *
 * Class-shaped for the same testability reason ResumeGate/CharacterSelect are — internal refs a
 * fake-DOM test harness can reach into. */
export class TitleScreen {
  private root: HTMLDivElement;
  private nameRowEl: HTMLDivElement;
  private nameValueEl: HTMLSpanElement;
  private nameInputEl: HTMLInputElement;
  private nameEditBtn: HTMLButtonElement;
  private nameSaveBtn: HTMLButtonElement;
  private beginBtn: HTMLButtonElement;
  private resolveContinue: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'rw-title';
    this.root.innerHTML = `
      <style>
        .rw-title {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 50% 38%, #14231a 0%, #070a08 75%);
          font-family: var(--body-face, ui-sans-serif, system-ui, sans-serif);
          color: var(--parchment, #eef2e6);
          animation: rw-title-fade-in 480ms ease-out both;
        }
        @keyframes rw-title-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .rw-title-panel {
          display: flex; flex-direction: column; align-items: center; gap: 34px;
          max-width: 560px; padding: 32px; text-align: center;
        }
        /* Three real, clearly separated zones — hero, how-it-plays, actions — each with its own
           tight internal spacing and real air between zones, rather than one long stack of
           same-weight rows. Nothing in the hero or how-it-plays zone names a key or control —
           that's Input.ts's own vocabulary, not a story a first-time player is reading before
           they've even touched anything; the in-game "?" legend (see HUD.ts) is where control
           specifics belong, once there's something real on screen to bind them to. */
        .rw-title-hero { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .rw-title-wordmark {
          font-family: var(--display-face, ui-serif, Georgia, serif);
          font-size: 56px; letter-spacing: 0.03em; color: var(--parchment, #eef2e6);
          text-shadow: 0 0 32px rgba(111,242,255,0.3);
        }
        .rw-title-tagline { font-size: 14px; opacity: 0.78; line-height: 1.65; max-width: 440px; }
        .rw-title-steps {
          display: flex; flex-direction: column; gap: 12px; width: 100%; text-align: left;
          padding: 18px 20px; border-radius: 10px;
          background: rgba(20,13,9,0.4); border: 1px solid rgba(238,242,230,0.14);
        }
        .rw-title-steps-eyebrow {
          text-transform: uppercase; font-size: 10px; letter-spacing: 0.14em;
          color: var(--spirit-amber, #ffb15e); opacity: 0.85;
        }
        .rw-title-step { display: flex; align-items: baseline; gap: 10px; font-size: 13px; line-height: 1.55; }
        .rw-title-step-num {
          font-family: var(--mono-face, ui-monospace, monospace); font-size: 10px;
          color: var(--myth-cyan, #6ff2ff); opacity: 0.85; min-width: 14px;
        }
        .rw-title-actions { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .rw-title-name-row {
          display: flex; align-items: center; gap: 8px; font-size: 12px;
          padding: 6px 12px; border-radius: 8px;
          background: rgba(20,13,9,0.5); border: 1px solid rgba(238,242,230,0.14);
        }
        .rw-title-name-label { opacity: 0.6; text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em; }
        .rw-title-name-value { color: var(--spirit-amber, #ffb15e); font-weight: 600; }
        .rw-title-name-input {
          font: inherit; font-size: 12px; color: var(--parchment, #eef2e6);
          background: rgba(7,10,8,0.6); border: 1px solid rgba(255,177,94,0.5); border-radius: 4px;
          padding: 3px 8px; width: 150px;
        }
        .rw-title-name-input:focus { outline: none; border-color: var(--spirit-amber, #ffb15e); }
        .rw-title-name-edit, .rw-title-name-save {
          background: transparent; border: 1px solid rgba(238,242,230,0.25); color: inherit;
          border-radius: 4px; width: 22px; height: 22px; cursor: pointer; font-size: 11px; line-height: 1;
        }
        .rw-title-name-edit:hover, .rw-title-name-save:hover { background: rgba(255,177,94,0.15); }
        .rw-title-name-save { display: none; width: auto; padding: 0 10px; }
        .rw-title-editing .rw-title-name-value, .rw-title-editing .rw-title-name-edit { display: none; }
        .rw-title-editing .rw-title-name-input, .rw-title-editing .rw-title-name-save { display: inline-flex; align-items: center; }
        .rw-title-name-input { display: none; }
        .rw-title-begin {
          padding: 13px 36px; border-radius: 8px; border: none; cursor: pointer;
          font-family: var(--display-face, ui-serif, Georgia, serif); font-size: 16px; letter-spacing: 0.03em;
          background: var(--spirit-amber, #ffb15e); color: #14100a;
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .rw-title-begin:hover { transform: scale(1.04); box-shadow: 0 0 20px rgba(255,177,94,0.4); }
        .rw-title-begin:active { transform: scale(0.97); }
        .rw-title-github {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--parchment, #eef2e6); opacity: 0.55; text-decoration: none;
          transition: opacity 140ms ease;
        }
        .rw-title-github:hover { opacity: 0.9; }
        .rw-title-github svg { width: 13px; height: 13px; fill: currentColor; }
      </style>
      <div class="rw-title-panel">
        <div class="rw-title-hero">
          <div class="rw-title-wordmark">Rootwaker</div>
          <div class="rw-title-tagline">The roots remember every trespasser. Something ancient stirs beneath the hollow — and a fox-spirit courier is the one who wakes it.</div>
        </div>
        <div class="rw-title-steps">
          <div class="rw-title-steps-eyebrow">How a Playthrough Goes</div>
          <div class="rw-title-step"><span class="rw-title-step-num">1</span> Hunt the animals of the jungle — defeat one and you inherit its real strength.</div>
          <div class="rw-title-step"><span class="rw-title-step-num">2</span> Climb the mountain that watches over the jungle.</div>
          <div class="rw-title-step"><span class="rw-title-step-num">3</span> Defeat the King of the Mountain at the summit and claim your own coronation.</div>
          <div class="rw-title-step"><span class="rw-title-step-num">4</span> Duel other players directly, spirit against spirit — no one standing between you.</div>
        </div>
        <div class="rw-title-actions">
          <div class="rw-title-name-row">
            <span class="rw-title-name-label">Playing as</span>
            <span class="rw-title-name-value"></span>
            <input class="rw-title-name-input" type="text" maxlength="24" autocomplete="off" />
            <button class="rw-title-name-edit" type="button" aria-label="Edit your name">&#9998;</button>
            <button class="rw-title-name-save" type="button">Save</button>
          </div>
          <button class="rw-title-begin" type="button">Enter the Jungle</button>
          <a class="rw-title-github" href="https://github.com/kabirnarang39/rootwaker" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
            View source on GitHub
          </a>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    this.nameRowEl = this.root.querySelector('.rw-title-name-row')!;
    this.nameValueEl = this.root.querySelector('.rw-title-name-value')!;
    this.nameInputEl = this.root.querySelector('.rw-title-name-input')!;
    this.nameEditBtn = this.root.querySelector('.rw-title-name-edit')!;
    this.nameSaveBtn = this.root.querySelector('.rw-title-name-save')!;
    this.beginBtn = this.root.querySelector('.rw-title-begin')!;

    this.nameValueEl.textContent = getDisplayName();

    this.nameEditBtn.addEventListener('click', () => this.startEditingName());
    this.nameSaveBtn.addEventListener('click', () => this.saveName());
    this.nameInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveName();
      if (e.key === 'Escape') this.cancelEditingName();
    });
    this.beginBtn.addEventListener('click', () => this.confirm());
  }

  private startEditingName(): void {
    this.nameInputEl.value = getDisplayName();
    this.nameRowEl.classList.add('rw-title-editing');
    this.nameInputEl.focus();
    this.nameInputEl.select();
  }

  private cancelEditingName(): void {
    this.nameRowEl.classList.remove('rw-title-editing');
  }

  private saveName(): void {
    const trimmed = this.nameInputEl.value.trim();
    if (trimmed) {
      setDisplayName(trimmed);
      this.nameValueEl.textContent = getDisplayName();
    }
    this.cancelEditingName();
  }

  private confirm(): void {
    // A player who typed a name but never clicked Save/Enter shouldn't lose it just because
    // they went straight for the primary CTA instead — commit whatever's in the field first.
    if (this.nameRowEl.classList.contains('rw-title-editing')) {
      this.saveName();
    }
    this.root.remove();
    this.resolveContinue?.();
  }

  whenContinue(): Promise<void> {
    return new Promise((resolve) => {
      this.resolveContinue = resolve;
    });
  }
}
