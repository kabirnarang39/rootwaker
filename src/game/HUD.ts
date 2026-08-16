import type { LeaderboardEntry } from '../leaderboard/LeaderboardClient';
import type { FoxSkin } from '../scene/skins';
import type { Ability } from './AbilityKit';

export class HUD {
  private root: HTMLDivElement;
  private healthBarEl: HTMLDivElement;
  private staminaBarEl: HTMLDivElement;
  private objectiveEl: HTMLDivElement;
  private huntPromptEl: HTMLDivElement;
  private abilityToastEl: HTMLDivElement;
  private abilityNameEl: HTMLDivElement;
  private abilityDescEl: HTMLDivElement;
  private abilityToastTimer: number | null = null;
  private overlay: HTMLDivElement;
  private overlayStats: HTMLDivElement;
  private overlayTitle: HTMLDivElement;
  private leaderboardEl: HTMLOListElement;
  private submitForm: HTMLFormElement;
  private submitInput: HTMLInputElement;
  private skinPickerEl: HTMLDivElement;
  private skinSwatchEl: HTMLSpanElement;
  private skinNameEl: HTMLSpanElement;
  private skinPrevBtn: HTMLButtonElement;
  private skinNextBtn: HTMLButtonElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.innerHTML = `
      <div class="rw-health-bar">
        <span class="rw-label">vitality</span>
        <div class="rw-health-track">
          <div class="rw-health-fill"></div>
        </div>
      </div>
      <div class="rw-stamina-bar">
        <span class="rw-label">stamina</span>
        <div class="rw-stamina-track">
          <div class="rw-stamina-fill"></div>
        </div>
      </div>
      <div class="rw-objective"></div>
      <div class="rw-hunt-prompt">
        <span class="rw-hunt-key">Space</span>
        <span class="rw-hunt-label">Pounce</span>
      </div>
      <div class="rw-ability-toast">
        <div class="rw-ability-eyebrow">Ability Unlocked</div>
        <div class="rw-ability-name"></div>
        <div class="rw-ability-desc"></div>
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
      .rw-health-bar, .rw-objective, .rw-overlay {
        --ink: #070a08;
        --parchment: #eef2e6;
        --moss: #4a7a5e;
        --myth-cyan: #6ff2ff;
        --vitality-low: #d9667a;
        --spirit-amber: #ffb15e;
        --bark: #140d09;
        --claim-red: #d9667a;
        --display-face: 'Fraunces', ui-serif, Georgia, serif;
        --body-face: 'Inter', ui-sans-serif, system-ui, sans-serif;
        --mono-face: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
      }

      .rw-label {
        text-transform: uppercase; font-size: 10px; letter-spacing: 0.12em;
        opacity: 0.55; display: block; margin-bottom: 1px;
      }

      /* Vitality: a bioluminescent "vein" rather than a stock progress bar — angled blade
         silhouette (echoes the claw/combat motif), fill color pulled from the fox-spirit's
         own glow palette (SKINS[0].glowColor ≈ --myth-cyan), shifting to a warning red as
         health runs low instead of a flat red/green default. */
      .rw-health-bar {
        position: fixed; top: 20px; left: 20px; z-index: 10;
        font-family: var(--body-face);
        color: var(--parchment);
        display: flex; flex-direction: column; gap: 6px;
        width: 190px;
        pointer-events: none;
      }
      .rw-health-track {
        position: relative;
        height: 11px;
        background: rgba(238,242,230,0.07);
        box-shadow: inset 0 0 0 1px rgba(238,242,230,0.14), inset 0 1px 2px rgba(0,0,0,0.4);
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
        overflow: hidden;
      }
      .rw-health-fill {
        position: absolute; inset: 0;
        width: var(--rw-hp-pct, 100%);
        background: linear-gradient(90deg, var(--moss), var(--myth-cyan));
        box-shadow: 0 0 10px 1px rgba(111,242,255,0.55), 0 0 2px rgba(111,242,255,0.9);
        transition: width 220ms ease-out, background 320ms ease;
      }
      .rw-health-bar.rw-critical .rw-health-fill {
        background: linear-gradient(90deg, var(--claim-red), var(--vitality-low));
        box-shadow: 0 0 10px 1px rgba(217,102,122,0.6), 0 0 2px rgba(217,102,122,0.9);
        animation: rw-vitality-pulse 1.1s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-health-bar.rw-critical .rw-health-fill { animation: none; }
      }

      /* Stamina: a sibling vein to vitality, same carved track/blade geometry, sitting
         directly beneath it so the two read as one instrument cluster. Traced to
         --spirit-amber (the HUD's already-established warm accent, used by the hunt
         prompt's idle key and the skin/submit controls) rather than a new hue — keeps
         the two meters legible at a glance without competing with vitality's cyan. */
      .rw-stamina-bar {
        position: fixed; top: 58px; left: 20px; z-index: 10;
        font-family: var(--body-face);
        color: var(--parchment);
        display: flex; flex-direction: column; gap: 6px;
        width: 190px;
        pointer-events: none;
      }
      .rw-stamina-track {
        position: relative;
        height: 11px;
        background: rgba(238,242,230,0.07);
        box-shadow: inset 0 0 0 1px rgba(238,242,230,0.14), inset 0 1px 2px rgba(0,0,0,0.4);
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
        overflow: hidden;
      }
      .rw-stamina-fill {
        position: absolute; inset: 0;
        width: var(--rw-sp-pct, 100%);
        background: linear-gradient(90deg, rgba(255,177,94,0.28), var(--spirit-amber));
        box-shadow: 0 0 10px 1px rgba(255,177,94,0.55), 0 0 2px rgba(255,177,94,0.9);
        transition: width 220ms ease-out;
      }

      /* Objective: bottom-center chapter prompt, styled as a carved bark plaque consistent
         with the overlay panel's material language rather than a floating toast. */
      .rw-objective {
        position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 10;
        pointer-events: none;
        font-family: var(--body-face); font-size: 13px; letter-spacing: 0.01em;
        color: var(--parchment); opacity: 0.92; text-align: center;
        padding: 10px 22px 9px;
        background: linear-gradient(180deg, rgba(20,13,9,0.62), rgba(7,10,8,0.8));
        border-top: 1px solid rgba(111,242,255,0.28);
        box-shadow: 0 0 24px rgba(0,0,0,0.4);
        clip-path: polygon(2% 0, 98% 0, 100% 100%, 0% 100%);
        animation: rw-objective-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-objective::before {
        content: 'Objective';
        display: block;
        text-transform: uppercase; font-size: 9px; letter-spacing: 0.14em;
        opacity: 0.5; margin-bottom: 3px;
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-objective { animation: none; }
      }

      /* Hunt prompt: a compact cousin of the objective plaque — same carved-bark gradient
         and angled clip-path, shrunk down and sitting just above it. Idle state reads muted
         amber (matches the skin-picker's interactive accent); once pounce is actually ready
         the key hint switches to the myth-cyan glow, the same signal the vitality bar uses
         for "alive and charged". */
      .rw-hunt-prompt {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 10;
        pointer-events: none; display: none; align-items: center; gap: 8px;
        font-family: var(--body-face); color: var(--parchment);
        padding: 7px 16px 6px;
        background: linear-gradient(180deg, rgba(20,13,9,0.6), rgba(7,10,8,0.78));
        border-top: 1px solid rgba(255,177,94,0.32);
        box-shadow: 0 0 16px rgba(0,0,0,0.35);
        clip-path: polygon(6% 0, 94% 0, 100% 100%, 0% 100%);
        opacity: 0.75;
        transition: opacity 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }
      .rw-hunt-prompt.rw-visible {
        display: flex;
        animation: rw-objective-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-hunt-prompt.rw-hunt-ready {
        opacity: 1;
        border-top-color: rgba(111,242,255,0.55);
        box-shadow: 0 0 18px rgba(111,242,255,0.3);
      }
      .rw-hunt-key {
        font-family: var(--mono-face); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
        padding: 2px 7px; border-radius: 3px; line-height: 1.5;
        background: rgba(255,177,94,0.12); border: 1px solid rgba(255,177,94,0.4);
      }
      .rw-hunt-ready .rw-hunt-key {
        background: rgba(111,242,255,0.16); border-color: rgba(111,242,255,0.55); color: var(--myth-cyan);
      }
      .rw-hunt-label { text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; opacity: 0.85; }
      @media (prefers-reduced-motion: reduce) {
        .rw-hunt-prompt.rw-visible { animation: none; }
      }

      /* Ability toast: same plaque geometry as the objective/hunt prompts, but the
         accent traces the vitality bar's own glow tokens (myth-cyan border + shadow,
         moss-to-cyan gradient) so an unlock reads as "your vein of power just grew"
         rather than a generic notification banner. Lifecycle (fade in / hold / fade
         out) lives in one keyframe timed to the ~3s auto-dismiss in showAbilityUnlocked. */
      .rw-ability-toast {
        position: fixed; top: 20px; left: 50%; z-index: 15;
        display: none; pointer-events: none; text-align: center;
        font-family: var(--body-face); color: var(--parchment);
        min-width: 220px; max-width: min(360px, 86vw);
        padding: 12px 26px 11px;
        background: linear-gradient(180deg, rgba(20,13,9,0.72), rgba(7,10,8,0.9));
        border-top: 1px solid rgba(111,242,255,0.5);
        box-shadow: 0 0 22px rgba(111,242,255,0.35), 0 12px 30px rgba(0,0,0,0.5);
        clip-path: polygon(3% 0, 97% 0, 100% 100%, 0% 100%);
      }
      .rw-ability-toast.rw-visible {
        display: block;
        animation: rw-ability-toast 3000ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-ability-eyebrow {
        text-transform: uppercase; font-size: 9px; letter-spacing: 0.16em;
        color: var(--myth-cyan); opacity: 0.85; margin-bottom: 4px;
      }
      .rw-ability-name {
        font-family: var(--display-face); font-weight: 600; font-size: 18px;
        letter-spacing: 0.01em; text-shadow: 0 0 16px rgba(111,242,255,0.4);
        margin-bottom: 3px;
      }
      .rw-ability-desc { font-size: 12px; opacity: 0.8; line-height: 1.45; }
      @keyframes rw-ability-toast {
        0% { opacity: 0; transform: translate(-50%, -14px) scale(0.97); }
        8%, 86% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -10px) scale(0.98); }
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-ability-toast.rw-visible { animation: none; opacity: 1; transform: translate(-50%, 0); }
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
      @keyframes rw-objective-in {
        from { opacity: 0; transform: translate(-50%, 8px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes rw-vitality-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.55; }
      }
    `;
    document.head.appendChild(style);

    this.healthBarEl = this.root.querySelector('.rw-health-bar')!;
    this.staminaBarEl = this.root.querySelector('.rw-stamina-bar')!;
    this.objectiveEl = this.root.querySelector('.rw-objective')!;
    this.objectiveEl.textContent = 'Cross the hollow. Reach the climbing wall.';
    this.huntPromptEl = this.root.querySelector('.rw-hunt-prompt')!;
    this.abilityToastEl = this.root.querySelector('.rw-ability-toast')!;
    this.abilityNameEl = this.root.querySelector('.rw-ability-name')!;
    this.abilityDescEl = this.root.querySelector('.rw-ability-desc')!;
    this.overlay = this.root.querySelector('.rw-overlay')!;
    this.overlayStats = this.root.querySelector('.rw-overlay-stats')!;
    this.overlayTitle = this.root.querySelector('.rw-overlay-title')!;
    this.leaderboardEl = this.root.querySelector('.rw-leaderboard')!;
    this.submitForm = this.root.querySelector('.rw-submit-form')!;
    this.submitInput = this.root.querySelector('.rw-submit-input')!;
    this.skinPickerEl = this.root.querySelector('.rw-skin-picker')!;
    this.skinSwatchEl = this.root.querySelector('.rw-skin-swatch')!;
    this.skinNameEl = this.root.querySelector('.rw-skin-name')!;
    this.skinPrevBtn = this.root.querySelector('.rw-skin-prev')!;
    this.skinNextBtn = this.root.querySelector('.rw-skin-next')!;

    // typing a name shouldn't trigger the global space/enter restart listener
    this.submitForm.addEventListener('keydown', (e) => e.stopPropagation());
  }

  /** Drives the vitality bar's fill width and its low-health warning state. */
  updateHealth(hp: number, maxHp: number) {
    const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
    this.healthBarEl.style.setProperty('--rw-hp-pct', `${pct}%`);
    this.healthBarEl.classList.toggle('rw-critical', pct > 0 && pct <= 25);
  }

  /** Drives the stamina bar's fill width, mirroring updateHealth's clamp pattern. */
  updateStamina(stamina: number, maxStamina: number) {
    const pct = Math.max(0, Math.min(100, Math.round((stamina / maxStamina) * 100)));
    this.staminaBarEl.style.setProperty('--rw-sp-pct', `${pct}%`);
  }

  /** Driven every frame by Game.ts's hunt logic — shows/updates the compact pounce prompt. */
  showHuntPrompt(canPounce: boolean) {
    this.huntPromptEl.classList.add('rw-visible');
    this.huntPromptEl.classList.toggle('rw-hunt-ready', canPounce);
  }

  hideHuntPrompt() {
    this.huntPromptEl.classList.remove('rw-visible', 'rw-hunt-ready');
  }

  /** Short-lived toast for a newly unlocked ability; auto-dismisses after ~3s. */
  showAbilityUnlocked(ability: Ability) {
    this.abilityNameEl.textContent = ability.name;
    this.abilityDescEl.textContent = ability.description;

    // restart the CSS lifecycle animation even if a toast is already mid-flight
    this.abilityToastEl.classList.remove('rw-visible');
    void this.abilityToastEl.offsetWidth;
    this.abilityToastEl.classList.add('rw-visible');

    if (this.abilityToastTimer !== null) window.clearTimeout(this.abilityToastTimer);
    this.abilityToastTimer = window.setTimeout(() => {
      this.abilityToastEl.classList.remove('rw-visible');
      this.abilityToastTimer = null;
    }, 3000);
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
