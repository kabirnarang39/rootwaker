import type { GameSaveState } from './SaveGame';
import { SPECIES_LABELS } from '../scene/createPlayableCharacter';

export type ResumeDecision = { action: 'resume' } | { action: 'new-game' };

function formatTimeSince(savedAt: number): string {
  const minutes = Math.floor((Date.now() - savedAt) / 60000);
  if (minutes < 1) return 'moments ago';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Shown before CharacterSelect only when a real encrypted save exists (see SaveGame.ts) — lets
 * the player pick up their saved progress instead of silently starting over, or explicitly wipe
 * it and begin fresh. Class-shaped for the same testability reason CharacterSelect.ts is (a test
 * can reach `whenDecided`'s internal button refs the same fake-DOM-harness way HUD's tests do). */
export class ResumeGate {
  private root: HTMLDivElement;
  private resumeBtn: HTMLButtonElement;
  private newGameBtn: HTMLButtonElement;
  private resolveDecision: ((decision: ResumeDecision) => void) | null = null;

  constructor(container: HTMLElement, save: GameSaveState) {
    this.root = document.createElement('div');
    this.root.className = 'rw-resume-gate';
    const speciesName = SPECIES_LABELS[save.species]?.name ?? save.species;
    const title = save.kingDefeated ? 'The Throne Awaits Your Return' : 'A Reign Interrupted';
    this.root.innerHTML = `
      <style>
        .rw-resume-gate {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 50% 40%, #14231a 0%, #070a08 75%);
          font-family: var(--body-face, ui-sans-serif, system-ui, sans-serif);
          color: var(--parchment, #eef2e6);
          animation: rw-rg-fade-in 420ms ease-out both;
        }
        @keyframes rw-rg-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .rw-rg-panel { display: flex; flex-direction: column; align-items: center; gap: 18px; max-width: 460px; padding: 32px; text-align: center; }
        .rw-rg-title {
          font-family: var(--display-face, ui-serif, Georgia, serif);
          font-size: 30px; letter-spacing: 0.02em; color: var(--parchment, #eef2e6);
          text-shadow: 0 0 24px rgba(255,177,94,0.25);
        }
        .rw-rg-stats { font-size: 13px; opacity: 0.75; line-height: 1.6; }
        .rw-rg-buttons { display: flex; gap: 14px; margin-top: 8px; }
        .rw-rg-btn {
          padding: 12px 28px; border-radius: 8px; cursor: pointer;
          font-family: var(--display-face, ui-serif, Georgia, serif); font-size: 15px; letter-spacing: 0.03em;
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .rw-rg-btn:active { transform: scale(0.97); }
        .rw-rg-resume {
          border: none; background: var(--spirit-amber, #ffb15e); color: #14100a;
        }
        .rw-rg-resume:hover { transform: scale(1.04); box-shadow: 0 0 20px rgba(255,177,94,0.4); }
        .rw-rg-newgame {
          border: 1px solid rgba(238,242,230,0.3); background: transparent; color: var(--parchment, #eef2e6);
        }
        .rw-rg-newgame:hover { background: rgba(238,242,230,0.08); }
      </style>
      <div class="rw-rg-panel">
        <div class="rw-rg-title">${title}</div>
        <div class="rw-rg-stats">
          ${speciesName} · ${save.hp}/${save.maxHp} vitality · ${save.animalsDefeated} animals defeated<br>
          Saved ${formatTimeSince(save.savedAt)}
        </div>
        <div class="rw-rg-buttons">
          <button class="rw-rg-btn rw-rg-resume" type="button">Continue</button>
          <button class="rw-rg-btn rw-rg-newgame" type="button">Begin Anew</button>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    this.resumeBtn = this.root.querySelector('.rw-rg-resume')!;
    this.newGameBtn = this.root.querySelector('.rw-rg-newgame')!;
    this.resumeBtn.addEventListener('click', () => this.decide({ action: 'resume' }));
    this.newGameBtn.addEventListener('click', () => this.decide({ action: 'new-game' }));
  }

  private decide(decision: ResumeDecision): void {
    this.root.remove();
    this.resolveDecision?.(decision);
  }

  whenDecided(): Promise<ResumeDecision> {
    return new Promise((resolve) => {
      this.resolveDecision = resolve;
    });
  }
}
