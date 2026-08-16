import type { LeaderboardEntry } from '../leaderboard/LeaderboardClient';
import type { FoxSkin } from '../scene/skins';

export class HUD {
  private root: HTMLDivElement;
  private distanceEl: HTMLSpanElement;
  private motesEl: HTMLSpanElement;
  private overlay: HTMLDivElement;
  private overlayStats: HTMLDivElement;
  private overlayTitle: HTMLDivElement;
  private buffEl: HTMLDivElement;
  private buffLabelEl: HTMLSpanElement;
  private buffTimeEl: HTMLSpanElement;
  private leaderboardEl: HTMLOListElement;
  private submitForm: HTMLFormElement;
  private submitInput: HTMLInputElement;
  private scoreEl: HTMLSpanElement;
  private comboEl: HTMLSpanElement;
  private skinPickerEl: HTMLDivElement;
  private skinSwatchEl: HTMLSpanElement;
  private skinNameEl: HTMLSpanElement;
  private skinPrevBtn: HTMLButtonElement;
  private skinNextBtn: HTMLButtonElement;
  private lastMultiplier = 1;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.innerHTML = `
      <div class="rw-hud">
        <div class="rw-hero-stat">
          <span class="rw-label">score</span>
          <span class="rw-score-row">
            <span class="rw-score">0</span>
            <span class="rw-combo"></span>
          </span>
        </div>
        <div class="rw-sub-stats">
          <span class="rw-stat"><span class="rw-distance">0</span>m</span>
          <span class="rw-stat-dot">&middot;</span>
          <span class="rw-stat"><span class="rw-motes">0</span> motes</span>
        </div>
        <div class="rw-stat rw-buff" style="display:none"><span class="rw-buff-label"></span> <span class="rw-buff-time"></span>s</div>
      </div>
      <div class="rw-overlay">
        <div class="rw-panel">
          <div class="rw-overlay-title"></div>
          <div class="rw-overlay-stats"></div>
          <div class="rw-skin-picker" style="display:none">
            <button class="rw-skin-prev" type="button" aria-label="previous skin">
              <svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 2 L4 8 L10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <span class="rw-skin-swatch"></span>
            <span class="rw-skin-name"></span>
            <button class="rw-skin-next" type="button" aria-label="next skin">
              <svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 2 L12 8 L6 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <ol class="rw-leaderboard" style="display:none"></ol>
          <form class="rw-submit-form" style="display:none">
            <input class="rw-submit-input" type="text" maxlength="20" placeholder="your name" autocomplete="off" />
            <button class="rw-submit-btn" type="submit">carve into the bark</button>
          </form>
          <div class="rw-overlay-hint">press space &middot; tap to run</div>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    const style = document.createElement('style');
    style.textContent = `
      .rw-hud, .rw-overlay {
        --ink: #070a08;
        --parchment: #eef2e6;
        --moss: #4a7a5e;
        --myth-cyan: #6ff2ff;
        --spirit-amber: #ffb15e;
        --bark: #140d09;
        --claim-red: #d9667a;
        --display-face: 'Fraunces', ui-serif, Georgia, serif;
        --body-face: 'Inter', ui-sans-serif, system-ui, sans-serif;
        --mono-face: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
      }

      .rw-hud {
        position: fixed; top: 20px; left: 20px; z-index: 10;
        font-family: var(--body-face);
        color: var(--parchment);
        display: flex; flex-direction: column; gap: 5px;
        pointer-events: none;
      }
      .rw-label {
        text-transform: uppercase; font-size: 10px; letter-spacing: 0.12em;
        opacity: 0.55; display: block; margin-bottom: 1px;
      }
      .rw-hero-stat { line-height: 1; }
      .rw-score-row { display: inline-flex; align-items: baseline; gap: 8px; }
      .rw-score {
        font-family: var(--mono-face); font-size: 32px; font-weight: 600;
        color: var(--spirit-amber); text-shadow: 0 0 14px rgba(255,177,94,0.5);
        font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
      }
      .rw-combo {
        font-family: var(--mono-face); font-size: 14px; font-weight: 600;
        color: var(--spirit-amber); opacity: 0.85;
      }
      .rw-combo.rw-pop { animation: rw-combo-pop 320ms ease-out; }
      .rw-sub-stats {
        font-family: var(--mono-face); font-size: 13px; opacity: 0.75;
        display: flex; align-items: center; gap: 7px;
      }
      .rw-stat-dot { opacity: 0.4; }
      .rw-distance, .rw-motes { font-variant-numeric: tabular-nums; }
      .rw-buff {
        font-family: var(--body-face); color: var(--myth-cyan);
        text-shadow: 0 0 8px rgba(111,242,255,0.6);
        text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em;
        margin-top: 3px;
      }

      .rw-overlay {
        position: fixed; inset: 0; z-index: 20;
        display: none; align-items: center; justify-content: center;
        background: radial-gradient(ellipse at center, rgba(4,8,10,0.35) 0%, rgba(2,4,6,0.82) 72%);
        font-family: var(--body-face); color: var(--parchment);
      }
      .rw-overlay.rw-visible { display: flex; }

      .rw-panel {
        position: relative;
        width: min(420px, 88vw);
        max-height: 84vh;
        overflow-y: auto;
        padding: 46px 34px 30px;
        text-align: center;
        display: flex; flex-direction: column; align-items: center; gap: 16px;
        background: linear-gradient(160deg, rgba(15,24,18,0.94), rgba(7,10,8,0.97));
        clip-path: polygon(
          1.5% 5%, 14% 0.5%, 32% 2.5%, 52% 0%, 70% 2%, 88% 0.5%, 100% 4%,
          98.5% 92%, 85% 99.5%, 68% 97%, 48% 100%, 30% 97.5%, 12% 99.5%, 0% 95%
        );
        filter: drop-shadow(0 0 1px rgba(255,177,94,0.35)) drop-shadow(0 18px 60px rgba(0,0,0,0.65));
      }
      .rw-overlay.rw-visible .rw-panel { animation: rw-panel-in 460ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      @media (prefers-reduced-motion: reduce) {
        .rw-overlay.rw-visible .rw-panel { animation: none; }
        .rw-combo.rw-pop { animation: none; }
      }

      .rw-overlay-title {
        font-family: var(--display-face); font-weight: 600; font-size: 30px;
        letter-spacing: 0.01em; color: var(--parchment);
        text-shadow: 0 0 22px rgba(111,242,255,0.35);
      }
      .rw-overlay-stats {
        font-family: var(--body-face); font-size: 14px; opacity: 0.8;
        line-height: 1.6;
      }
      .rw-overlay-stats.rw-stats-numeric { font-family: var(--mono-face); font-size: 13px; }
      .rw-overlay-hint {
        font-size: 11px; opacity: 0.45; text-transform: uppercase;
        letter-spacing: 0.1em; margin-top: 2px;
      }

      .rw-skin-picker {
        display: flex; align-items: center; gap: 12px; pointer-events: auto;
        font-family: var(--body-face); font-size: 13px;
      }
      .rw-skin-swatch {
        width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
        box-shadow: 0 0 12px 1px var(--swatch-glow, rgba(111,242,255,0.5));
        border: 1px solid rgba(238,242,230,0.25);
      }
      .rw-skin-name { min-width: 118px; letter-spacing: 0.02em; }
      .rw-skin-prev, .rw-skin-next {
        display: flex; align-items: center; justify-content: center;
        background: rgba(255,177,94,0.08); border: 1px solid rgba(255,177,94,0.4); border-radius: 6px;
        color: var(--parchment); width: 28px; height: 28px; cursor: pointer;
        transition: background 140ms ease, transform 100ms ease;
      }
      .rw-skin-prev:hover, .rw-skin-next:hover { background: rgba(255,177,94,0.2); }
      .rw-skin-prev:active, .rw-skin-next:active { transform: scale(0.92); }

      .rw-leaderboard {
        list-style: none; margin: 0; padding: 0; width: 100%;
        display: flex; flex-direction: column; gap: 3px; pointer-events: auto;
      }
      .rw-leaderboard li {
        display: flex; align-items: center; gap: 10px;
        font-size: 13px; padding: 4px 10px; border-radius: 4px;
        background: rgba(238,242,230,0.03);
      }
      .rw-leaderboard li.rw-me {
        background: rgba(255,177,94,0.14);
        box-shadow: inset 0 0 0 1px rgba(255,177,94,0.3);
      }
      .rw-leaderboard .rw-rank {
        font-family: var(--mono-face); width: 1.6em; text-align: right; flex-shrink: 0;
        opacity: 0.5;
      }
      .rw-leaderboard li:nth-child(1) .rw-rank { color: var(--spirit-amber); opacity: 1; }
      .rw-leaderboard li:nth-child(2) .rw-rank { color: var(--parchment); opacity: 0.85; }
      .rw-leaderboard li:nth-child(3) .rw-rank { color: #c98a5c; opacity: 0.9; }
      .rw-leaderboard .rw-name {
        flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rw-leaderboard .rw-dist {
        font-family: var(--mono-face); font-variant-numeric: tabular-nums; opacity: 0.85;
      }

      .rw-submit-form { display: flex; gap: 8px; pointer-events: auto; width: 100%; }
      .rw-submit-input {
        flex: 1; min-width: 0;
        background: rgba(7,10,8,0.6); border: 1px solid rgba(255,177,94,0.3); border-radius: 5px;
        color: var(--parchment); padding: 7px 10px; font-size: 13px;
        font-family: var(--body-face);
      }
      .rw-submit-input:focus-visible { outline: 2px solid var(--spirit-amber); outline-offset: 1px; }
      .rw-submit-btn {
        background: rgba(255,177,94,0.15); border: 1px solid rgba(255,177,94,0.55); border-radius: 5px;
        color: var(--parchment); padding: 7px 14px; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.05em; cursor: pointer; font-family: var(--body-face); white-space: nowrap;
        transition: background 140ms ease, transform 100ms ease;
      }
      .rw-submit-btn:hover { background: rgba(255,177,94,0.28); }
      .rw-submit-btn:active { transform: scale(0.97); }
      .rw-submit-btn:focus-visible, .rw-skin-prev:focus-visible, .rw-skin-next:focus-visible {
        outline: 2px solid var(--spirit-amber); outline-offset: 2px;
      }

      @keyframes rw-panel-in {
        from { opacity: 0; transform: translateY(10px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes rw-combo-pop {
        0% { transform: scale(1); }
        40% { transform: scale(1.35); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    this.distanceEl = this.root.querySelector('.rw-distance')!;
    this.motesEl = this.root.querySelector('.rw-motes')!;
    this.overlay = this.root.querySelector('.rw-overlay')!;
    this.overlayStats = this.root.querySelector('.rw-overlay-stats')!;
    this.overlayTitle = this.root.querySelector('.rw-overlay-title')!;
    this.buffEl = this.root.querySelector('.rw-buff')!;
    this.buffLabelEl = this.root.querySelector('.rw-buff-label')!;
    this.buffTimeEl = this.root.querySelector('.rw-buff-time')!;
    this.leaderboardEl = this.root.querySelector('.rw-leaderboard')!;
    this.submitForm = this.root.querySelector('.rw-submit-form')!;
    this.submitInput = this.root.querySelector('.rw-submit-input')!;
    this.scoreEl = this.root.querySelector('.rw-score')!;
    this.comboEl = this.root.querySelector('.rw-combo')!;
    this.skinPickerEl = this.root.querySelector('.rw-skin-picker')!;
    this.skinSwatchEl = this.root.querySelector('.rw-skin-swatch')!;
    this.skinNameEl = this.root.querySelector('.rw-skin-name')!;
    this.skinPrevBtn = this.root.querySelector('.rw-skin-prev')!;
    this.skinNextBtn = this.root.querySelector('.rw-skin-next')!;

    // typing a name shouldn't trigger the global space/enter restart listener
    this.submitForm.addEventListener('keydown', (e) => e.stopPropagation());
  }

  update(distance: number, motes: number, score = 0, multiplier = 1) {
    this.distanceEl.textContent = Math.floor(distance).toString();
    this.motesEl.textContent = motes.toString();
    this.scoreEl.textContent = Math.floor(score).toString();
    this.comboEl.textContent = multiplier > 1 ? `×${multiplier.toFixed(1)}` : '';
    if (multiplier > this.lastMultiplier) {
      this.comboEl.classList.remove('rw-pop');
      // force reflow so the animation restarts even if it's still running
      void this.comboEl.offsetWidth;
      this.comboEl.classList.add('rw-pop');
    }
    this.lastMultiplier = multiplier;
  }

  setBuff(buff: { label: string; seconds: number } | null) {
    if (!buff) {
      this.buffEl.style.display = 'none';
      return;
    }
    this.buffEl.style.display = '';
    this.buffLabelEl.textContent = buff.label;
    this.buffTimeEl.textContent = buff.seconds.toFixed(1);
  }

  showGameOver(distance: number, motes: number, score: number) {
    this.overlayTitle.textContent = 'The forest claims you';
    this.overlayStats.textContent = `${Math.floor(distance)}m · ${motes} motes · ${Math.floor(score)} score`;
    this.overlayStats.classList.add('rw-stats-numeric');
    this.hideSkinPicker();
    this.overlay.classList.add('rw-visible');
  }

  showStart() {
    this.overlayTitle.textContent = 'Rootwaker';
    this.overlayStats.textContent = 'a fox-spirit courier, a forest waking behind every step';
    this.overlayStats.classList.remove('rw-stats-numeric');
    this.overlay.classList.add('rw-visible');
  }

  showSkinPicker(skin: FoxSkin, onPrev: () => void, onNext: () => void) {
    this.skinNameEl.textContent = skin.name;
    this.skinSwatchEl.style.background = `radial-gradient(circle at 35% 30%, #${skin.furColor.toString(16).padStart(6, '0')}, #${skin.furDark.toString(16).padStart(6, '0')})`;
    this.skinSwatchEl.style.setProperty('--swatch-glow', `#${skin.glowColor.toString(16).padStart(6, '0')}`);
    this.skinPickerEl.style.display = 'flex';
    this.skinPrevBtn.onclick = onPrev;
    this.skinNextBtn.onclick = onNext;
  }

  hideSkinPicker() {
    this.skinPickerEl.style.display = 'none';
  }

  hideGameOver() {
    this.overlay.classList.remove('rw-visible');
    this.hideLeaderboard();
  }

  renderLeaderboard(entries: LeaderboardEntry[], highlightIndex: number | null) {
    this.leaderboardEl.innerHTML = '';
    entries.forEach((e, i) => {
      const li = document.createElement('li');
      if (i === highlightIndex) li.classList.add('rw-me');
      li.innerHTML = `<span class="rw-rank">${i + 1}</span><span class="rw-name">${escapeHtml(e.name)}</span><span class="rw-dist">${Math.floor(e.score)}</span>`;
      this.leaderboardEl.appendChild(li);
    });
    this.leaderboardEl.style.display = entries.length ? 'flex' : 'none';
  }

  showSubmitPrompt(defaultName: string, onSubmit: (name: string) => void) {
    this.submitInput.value = defaultName;
    this.submitForm.style.display = 'flex';
    const handler = (e: Event) => {
      e.preventDefault();
      const name = this.submitInput.value.trim() || 'a nameless spirit';
      onSubmit(name);
    };
    this.submitForm.onsubmit = handler;
  }

  hideSubmitPromptOnly() {
    this.submitForm.style.display = 'none';
    this.submitForm.onsubmit = null;
  }

  hideLeaderboard() {
    this.leaderboardEl.style.display = 'none';
    this.leaderboardEl.innerHTML = '';
    this.hideSubmitPromptOnly();
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
