import type { LeaderboardEntry } from '../leaderboard/LeaderboardClient';
import type { CoronationEntry } from '../leaderboard/CoronationLeaderboard';
import type { FoxSkin } from '../scene/skins';
import { SPECIES_LABELS } from '../scene/createPlayableCharacter';
import { ABILITIES, ABILITY_SLOTS, type Ability, type AbilityId } from './AbilityKit';

export interface PowerSlotState {
  id: AbilityId;
  unlocked: boolean;
  ready: boolean;
}

/** The static, world-space content the minimap draws once and reuses every frame — everything
 * here is real level geometry (Game.ts passes it straight from createJungleLevel()'s own
 * chapterBounds/mountain/water), never fabricated map art. Kept as a flat data shape (not a
 * dependency on JungleLevel's own type) so HUD.ts stays a pure presentation layer with no import
 * of the scene module, matching every other HUD method's existing contract (Game.ts always
 * passes primitives/small shapes in, never a live level/scene reference). */
export interface MinimapWorldData {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  mountainBase: { x: number; z: number };
  mountainSummit: { x: number; z: number };
  water: { minX: number; maxX: number; minZ: number; maxZ: number };
  // Real terrain contour, not a flat wash — sampled once in initMinimap() (terrain never changes
  // at runtime) to bake a real heightmap backdrop.
  groundHeightAt: (x: number, z: number) => number;
}

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
  private controlsLegendEl: HTMLDivElement;
  private viewModeToastEl: HTMLDivElement;
  private viewModeNameEl: HTMLDivElement;
  private viewModeToastTimer: number | null = null;
  private bossBarEl: HTMLDivElement;
  private bossNameEl: HTMLSpanElement;
  private bossHealthFillEl: HTMLDivElement;
  private arcCompleteEl: HTMLDivElement;
  private arcCompleteTimer: number | null = null;
  private coronationResultEl: HTMLDivElement;
  private coronationRankEl: HTMLDivElement;
  private coronationStatsEl: HTMLDivElement;
  private coronationListEl: HTMLOListElement;
  private coronationResultTimer: number | null = null;
  private storyBeatEl: HTMLDivElement;
  private storyEyebrowEl: HTMLDivElement;
  private storyTextEl: HTMLDivElement;
  private storyBeatTimer: number | null = null;
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
  private damageFlashEl: HTMLDivElement;
  private damageFlashTimer: number | null = null;
  private powerSlotEls: Map<AbilityId, HTMLDivElement> = new Map();
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private minimapWorld: MinimapWorldData | null = null;
  // Baked once in initMinimap() from a real sampled heightmap — terrain never changes at runtime,
  // so redrawing it from scratch every frame (like the rest of the minimap) would be pure waste.
  private minimapTerrainBackdrop: HTMLCanvasElement | null = null;

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
      <div class="rw-minimap">
        <span class="rw-label">the hollow</span>
        <canvas class="rw-minimap-canvas" width="190" height="190"></canvas>
      </div>
      <div class="rw-damage-flash"></div>
      <div class="rw-power-bar">
        ${ABILITY_SLOTS.map(
          (id) => `
          <div class="rw-power-slot" data-ability="${id}">
            <span class="rw-power-key">${ABILITIES[id].key}</span>
            <span class="rw-power-name">${ABILITIES[id].name}</span>
          </div>`,
        ).join('')}
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
      <div class="rw-view-mode-toast">
        <div class="rw-view-mode-name"></div>
      </div>
      <div class="rw-boss-bar">
        <span class="rw-boss-name"></span>
        <div class="rw-boss-track">
          <div class="rw-boss-fill"></div>
        </div>
      </div>
      <div class="rw-story-beat">
        <div class="rw-story-eyebrow"></div>
        <div class="rw-story-text"></div>
      </div>
      <div class="rw-arc-complete">
        <div class="rw-arc-eyebrow">Arc Complete</div>
        <div class="rw-arc-title">The summit gate swings open</div>
      </div>
      <div class="rw-coronation-result">
        <div class="rw-coronation-eyebrow">Coronation Record</div>
        <div class="rw-coronation-rank"></div>
        <div class="rw-coronation-stats"></div>
        <ol class="rw-coronation-list"></ol>
        <div class="rw-coronation-note">Local to this device only — not a shared leaderboard.</div>
      </div>
      <div class="rw-controls-legend">
        <div class="rw-legend-eyebrow">Controls</div>
        <div class="rw-legend-row"><span class="rw-legend-key">W A S D</span><span class="rw-legend-label">Move</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">Space</span><span class="rw-legend-label">Jump</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">J</span><span class="rw-legend-label">Attack</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">K</span><span class="rw-legend-label">Dodge</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">H</span><span class="rw-legend-label">Block</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">L</span><span class="rw-legend-label">Pounce</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">Drag</span><span class="rw-legend-label">Look</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">C</span><span class="rw-legend-label">View</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">1 – 7</span><span class="rw-legend-label">Powers</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">M</span><span class="rw-legend-label">Challenge</span></div>
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
      :root {
        --ink: #070a08;
        --parchment: #eef2e6;
        --moss: #4a7a5e;
        --myth-cyan: #6ff2ff;
        --vitality-low: #d9667a;
        --spirit-amber: #ffb15e;
        --ember: #ff6a3a;
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

      /* Minimap: sits directly under the vitality/stamina cluster, same top-left instrument
         column, framed in the identical carved-bark plaque language as the objective/legend
         panels (not a bare canvas floating on the world) so it reads as part of the HUD's one
         material system rather than a bolted-on debug overlay. The canvas itself draws in
         Game.ts-driven world-space content (see HUD.initMinimap/updateMinimap) — this block only
         owns the frame. Clip-path'd to the same angled-trapezoid silhouette as the other bark
         plaques for visual consistency, with the canvas's own border-radius matching the frame's
         rounded corner so the drawn content doesn't visibly square-off against a curved edge. */
      .rw-minimap {
        position: fixed; top: 96px; left: 20px; z-index: 10;
        pointer-events: none;
        font-family: var(--body-face); color: var(--parchment);
        width: 190px;
        padding: 8px 8px 7px;
        background: linear-gradient(180deg, rgba(20,13,9,0.6), rgba(7,10,8,0.8));
        border-top: 1px solid rgba(111,242,255,0.28);
        box-shadow: 0 0 18px rgba(0,0,0,0.4);
        clip-path: polygon(4% 0, 96% 0, 100% 6%, 100% 100%, 0 100%, 0 6%);
      }
      .rw-minimap .rw-label { margin-bottom: 5px; }
      .rw-minimap-canvas {
        display: block; width: 100%; height: 190px;
        border-radius: 2px;
        background: rgba(7,16,10,0.55);
        box-shadow: inset 0 0 0 1px rgba(238,242,230,0.1);
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

      /* View-mode toast: same fade-in/hold/fade-out lifecycle as the ability toast, but
         amber-toned (matches the controls legend's key-badge accent) and offset lower so the
         two never physically overlap even if both happen to fire close together. Shorter hold
         (1200ms) since it's a one-word confirmation, not content to read. */
      .rw-view-mode-toast {
        position: fixed; top: 90px; left: 50%; z-index: 15;
        display: none; pointer-events: none; text-align: center;
        font-family: var(--display-face); font-weight: 600; letter-spacing: 0.04em;
        color: var(--spirit-amber); font-size: 15px;
        padding: 8px 22px 7px;
        background: linear-gradient(180deg, rgba(20,13,9,0.72), rgba(7,10,8,0.9));
        border-top: 1px solid rgba(255,177,94,0.5);
        box-shadow: 0 0 18px rgba(255,177,94,0.3), 0 10px 24px rgba(0,0,0,0.45);
        clip-path: polygon(4% 0, 96% 0, 100% 100%, 0% 100%);
        text-transform: uppercase;
      }
      .rw-view-mode-toast.rw-visible {
        display: block;
        animation: rw-view-mode-toast 1200ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes rw-view-mode-toast {
        0% { opacity: 0; transform: translate(-50%, -10px) scale(0.97); }
        14%, 78% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -8px) scale(0.98); }
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-view-mode-toast.rw-visible { animation: none; opacity: 1; transform: translate(-50%, 0); }
      }

      /* Boss bar: same instrument language as vitality/stamina (carved track, gradient fill,
         glow shadow), but housed in its own plaque (like the objective panel) since it needs
         a name label above it and only appears for the throne-room fight. Sits at top:140px —
         below the ability toast (20px) and view-mode toast (90px) so a toast firing mid-fight
         never overlaps it — traced to a new --ember accent (molten/antagonist token, kept
         separate from the player-identity --myth-cyan/--spirit-amber tokens) rather than reusing
         vitality's cyan, so the player's own health and the boss's read as opposed forces. */
      .rw-boss-bar {
        position: fixed; top: 140px; left: 50%; transform: translateX(-50%); z-index: 12;
        display: none; pointer-events: none; text-align: center;
        font-family: var(--body-face); color: var(--parchment);
        width: 260px;
        padding: 10px 20px 9px;
        background: linear-gradient(180deg, rgba(20,13,9,0.7), rgba(7,10,8,0.88));
        border-top: 1px solid rgba(255,106,58,0.5);
        box-shadow: 0 0 20px rgba(255,106,58,0.3), 0 10px 26px rgba(0,0,0,0.5);
        clip-path: polygon(4% 0, 96% 0, 100% 100%, 0% 100%);
      }
      .rw-boss-bar.rw-visible {
        display: block;
        animation: rw-objective-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-boss-name {
        text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em;
        font-family: var(--display-face); font-weight: 600;
        color: var(--ember); opacity: 0.9; display: block; margin-bottom: 6px;
      }
      .rw-boss-track {
        position: relative;
        height: 11px;
        background: rgba(238,242,230,0.07);
        box-shadow: inset 0 0 0 1px rgba(238,242,230,0.14), inset 0 1px 2px rgba(0,0,0,0.4);
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
        overflow: hidden;
      }
      .rw-boss-fill {
        position: absolute; inset: 0;
        width: var(--fill, 100%);
        background: linear-gradient(90deg, #7a2a10, var(--ember));
        box-shadow: 0 0 10px 1px rgba(255,106,58,0.55), 0 0 2px rgba(255,106,58,0.9);
        transition: width 220ms ease-out;
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-boss-bar.rw-visible { animation: none; }
      }

      /* Story beat: a real narrative whisper for each first encounter, not a combat-power or
         boss-specific cue — deliberately traced to the calmer parchment/moss objective-panel
         palette rather than myth-cyan (abilities) or ember (the boss), so lore reads as its own
         voice, distinct from mechanical feedback. Sits at top:210px, safely below the boss bar's
         own footprint (140px + its ~50px height), since the King's own story beat fires the same
         moment the boss bar first appears — the two must never visually overlap. Held longer
         (4200ms) than the ability toast's 3000ms since this is real prose worth reading, not a
         one-line confirmation. */
      .rw-story-beat {
        position: fixed; top: 210px; left: 50%; z-index: 13;
        display: none; pointer-events: none; text-align: center;
        font-family: var(--body-face); color: var(--parchment);
        min-width: 240px; max-width: min(400px, 88vw);
        padding: 13px 28px 12px;
        background: linear-gradient(180deg, rgba(20,13,9,0.7), rgba(7,10,8,0.88));
        border-top: 1px solid rgba(74,122,94,0.5);
        box-shadow: 0 0 20px rgba(74,122,94,0.25), 0 12px 30px rgba(0,0,0,0.5);
        clip-path: polygon(3% 0, 97% 0, 100% 100%, 0% 100%);
      }
      .rw-story-beat.rw-visible {
        display: block;
        animation: rw-story-beat-toast 4200ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-story-eyebrow {
        text-transform: uppercase; font-size: 9px; letter-spacing: 0.16em;
        color: var(--moss); opacity: 0.9; margin-bottom: 5px;
      }
      .rw-story-text {
        font-family: var(--display-face); font-size: 15px; font-style: italic;
        letter-spacing: 0.01em; line-height: 1.5; opacity: 0.95;
        text-shadow: 0 0 14px rgba(74,122,94,0.3);
      }
      @keyframes rw-story-beat-toast {
        0% { opacity: 0; transform: translate(-50%, -10px) scale(0.98); }
        7%, 88% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -8px) scale(0.99); }
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-story-beat.rw-visible { animation: none; opacity: 1; transform: translate(-50%, 0); }
      }

      /* Arc-complete toast: the ability toast's exact fade lifecycle, but centered on the
         screen instead of top-anchored — this is the chapter's climax beat (throne room
         cleared), not a routine pickup notification, so it gets the most prominent position
         and the highest z-index in the file, plus a longer 4s hold (vs. the ability toast's
         3s). Centering also means it never collides with any top-stacked panel (health/boss
         bar/toasts) even if one happens to be visible at the same moment. Ember-accented to
         match the boss bar it's paying off. */
      .rw-arc-complete {
        position: fixed; top: 50%; left: 50%; z-index: 16;
        display: none; pointer-events: none; text-align: center;
        font-family: var(--body-face); color: var(--parchment);
        min-width: 260px; max-width: min(420px, 88vw);
        padding: 16px 32px 14px;
        background: linear-gradient(180deg, rgba(20,13,9,0.8), rgba(7,10,8,0.94));
        border-top: 1px solid rgba(255,106,58,0.6);
        box-shadow: 0 0 32px rgba(255,106,58,0.4), 0 18px 44px rgba(0,0,0,0.55);
        clip-path: polygon(3% 0, 97% 0, 100% 100%, 0% 100%);
      }
      .rw-arc-complete.rw-visible {
        display: block;
        animation: rw-arc-complete-toast 4000ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-arc-eyebrow {
        text-transform: uppercase; font-size: 10px; letter-spacing: 0.18em;
        color: var(--ember); opacity: 0.9; margin-bottom: 5px;
      }
      .rw-arc-title {
        font-family: var(--display-face); font-weight: 600; font-size: 22px;
        letter-spacing: 0.01em; text-shadow: 0 0 18px rgba(255,106,58,0.45);
      }
      @keyframes rw-arc-complete-toast {
        0% { opacity: 0; transform: translate(-50%, calc(-50% - 14px)) scale(0.97); }
        10%, 88% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, calc(-50% - 10px)) scale(0.98); }
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-arc-complete.rw-visible { animation: none; opacity: 1; transform: translate(-50%, -50%); }
      }

      /* The coronation-record panel: fires alongside rw-arc-complete but positioned well below it
         (top offset, not the same 50% center) so the two never overlap even though both can be
         visible at once — this is the real payoff of the new local leaderboard (see
         CoronationLeaderboard.ts), shown at the exact moment the King falls. Amber-accented
         (matches the ability/legend key-badge amber) rather than arc-complete's ember, so the two
         climax beats read as related but distinct. Longer hold (7s) than any other toast in the
         file — this one has real numbers to actually read, not just a title. */
      .rw-coronation-result {
        position: fixed; top: calc(50% + 130px); left: 50%; z-index: 15;
        display: none; pointer-events: none; text-align: center;
        font-family: var(--body-face); color: var(--parchment);
        min-width: 240px; max-width: min(320px, 86vw);
        padding: 14px 24px 12px;
        background: linear-gradient(180deg, rgba(20,13,9,0.82), rgba(7,10,8,0.95));
        border-top: 1px solid rgba(255,177,94,0.55);
        box-shadow: 0 0 26px rgba(255,177,94,0.3), 0 14px 34px rgba(0,0,0,0.5);
        clip-path: polygon(3% 0, 97% 0, 100% 100%, 0% 100%);
      }
      .rw-coronation-result.rw-visible {
        display: block;
        animation: rw-coronation-toast 7000ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-coronation-eyebrow {
        text-transform: uppercase; font-size: 9px; letter-spacing: 0.16em;
        color: var(--spirit-amber); opacity: 0.9; margin-bottom: 4px;
      }
      .rw-coronation-rank {
        font-family: var(--display-face); font-weight: 600; font-size: 17px;
        margin-bottom: 3px;
      }
      .rw-coronation-stats {
        font-family: var(--mono-face); font-size: 11px; opacity: 0.8; margin-bottom: 8px;
      }
      .rw-coronation-list {
        list-style: none; margin: 0 0 8px; padding: 0;
        font-family: var(--mono-face); font-size: 10px; text-align: left;
        display: flex; flex-direction: column; gap: 2px;
      }
      .rw-coronation-list li {
        display: flex; justify-content: space-between; opacity: 0.75;
      }
      .rw-coronation-list li.rw-coronation-me { opacity: 1; color: var(--spirit-amber); }
      .rw-coronation-note {
        font-size: 9px; opacity: 0.5; font-style: italic;
      }
      @keyframes rw-coronation-toast {
        0% { opacity: 0; transform: translate(-50%, calc(-50% + 14px)) scale(0.97); }
        8%, 90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, calc(-50% + 10px)) scale(0.98); }
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-coronation-result.rw-visible { animation: none; opacity: 1; transform: translate(-50%, -50%); }
      }

      /* Controls legend: opposite corner from the vitality/stamina cluster, same carved-bark
         plaque trapezoid and idle-amber key-badge treatment as the hunt prompt (rw-hunt-key)
         rather than a new visual language. Visible by default (a fresh player needs it before
         they've touched anything); dismissLegend() just fades it via class toggle, same
         opacity/transform fade idiom the objective/toast panels already use. No auto-timer —
         a player who never moves should keep seeing it. */
      .rw-controls-legend {
        position: fixed; top: 20px; right: 20px; z-index: 10;
        pointer-events: none; text-align: right;
        font-family: var(--body-face); color: var(--parchment);
        padding: 10px 18px 10px;
        background: linear-gradient(180deg, rgba(20,13,9,0.62), rgba(7,10,8,0.8));
        border-top: 1px solid rgba(255,177,94,0.32);
        box-shadow: 0 0 20px rgba(0,0,0,0.4);
        clip-path: polygon(6% 0, 94% 0, 100% 100%, 0% 100%);
        opacity: 0.92;
        transition: opacity 420ms cubic-bezier(0.16, 1, 0.3, 1), transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .rw-controls-legend.rw-legend-hidden {
        opacity: 0;
        transform: translateY(-6px);
      }
      .rw-legend-eyebrow {
        text-transform: uppercase; font-size: 9px; letter-spacing: 0.16em;
        color: var(--spirit-amber); opacity: 0.85; margin-bottom: 6px;
      }
      .rw-legend-row {
        display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        margin-top: 5px;
      }
      .rw-legend-row:first-of-type { margin-top: 0; }
      .rw-legend-key {
        font-family: var(--mono-face); font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em;
        padding: 2px 7px; border-radius: 3px; line-height: 1.5; min-width: 44px; text-align: center;
        background: rgba(255,177,94,0.12); border: 1px solid rgba(255,177,94,0.4);
      }
      .rw-legend-label { text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; opacity: 0.85; }
      @media (prefers-reduced-motion: reduce) {
        .rw-controls-legend { transition: opacity 1ms linear; }
      }

      /* Damage flash: a full-screen red vignette pulse — the "you got hit" signal that was
         previously missing entirely (health bar only reflected the new value, no immediate
         cue). Sits above every other HUD layer (z-index 18) but below the arc-complete/overlay
         beats, and never intercepts pointer events. */
      .rw-damage-flash {
        position: fixed; inset: 0; z-index: 18; pointer-events: none;
        opacity: 0;
        background: radial-gradient(ellipse at center, rgba(217,102,122,0) 45%, rgba(217,102,122,0.35) 100%);
      }
      .rw-damage-flash.rw-flash-active {
        animation: rw-damage-flash 320ms ease-out;
      }
      @keyframes rw-damage-flash {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-damage-flash.rw-flash-active { animation: none; }
      }

      /* Power bar: the six learned-ability slots, bottom-left — same carved-plaque key-badge
         language as the controls legend (rw-legend-key), so activatable powers read as part of
         the same instrument family rather than a new UI language. Locked slots sit dim/inert;
         unlocked-but-cooling-down slots dim briefly (rw-power-cooldown); unlocked+ready slots
         get the myth-cyan "charged" treatment vitality/hunt-prompt already use for "ready".
         flex-wrap + the viewport-relative max-width: at 6 slots (~74px each incl. padding) the
         bar runs to ~480px, wider than most phone viewports — wrapping to a second row (growing
         upward, since only bottom is anchored) reads fine here and avoids slots running off
         the right edge of the screen on narrow viewports. */
      .rw-power-bar {
        position: fixed; bottom: 26px; left: 20px; z-index: 10;
        pointer-events: none; display: flex; flex-wrap: wrap; gap: 8px;
        max-width: calc(100vw - 40px);
        font-family: var(--body-face); color: var(--parchment);
      }
      .rw-power-slot {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        padding: 6px 10px 5px; min-width: 54px;
        background: linear-gradient(180deg, rgba(20,13,9,0.55), rgba(7,10,8,0.72));
        border-top: 1px solid rgba(238,242,230,0.14);
        clip-path: polygon(10% 0, 90% 0, 100% 100%, 0% 100%);
        opacity: 0.32;
        transition: opacity 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }
      .rw-power-slot.rw-power-unlocked {
        opacity: 0.55;
        border-top-color: rgba(255,177,94,0.4);
      }
      .rw-power-slot.rw-power-ready {
        opacity: 1;
        border-top-color: rgba(111,242,255,0.55);
        box-shadow: 0 0 14px rgba(111,242,255,0.28);
      }
      .rw-power-key {
        font-family: var(--mono-face); font-size: 10px; text-transform: uppercase;
        padding: 1px 6px; border-radius: 3px;
        background: rgba(255,177,94,0.12); border: 1px solid rgba(255,177,94,0.4);
      }
      .rw-power-name {
        font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.85;
        text-align: center; line-height: 1.3;
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
    this.controlsLegendEl = this.root.querySelector('.rw-controls-legend')!;
    this.viewModeToastEl = this.root.querySelector('.rw-view-mode-toast')!;
    this.viewModeNameEl = this.root.querySelector('.rw-view-mode-name')!;
    this.bossBarEl = this.root.querySelector('.rw-boss-bar')!;
    this.bossNameEl = this.root.querySelector('.rw-boss-name')!;
    this.bossHealthFillEl = this.root.querySelector('.rw-boss-fill')!;
    this.arcCompleteEl = this.root.querySelector('.rw-arc-complete')!;
    this.coronationResultEl = this.root.querySelector('.rw-coronation-result')!;
    this.coronationRankEl = this.root.querySelector('.rw-coronation-rank')!;
    this.coronationStatsEl = this.root.querySelector('.rw-coronation-stats')!;
    this.coronationListEl = this.root.querySelector('.rw-coronation-list')!;
    this.storyBeatEl = this.root.querySelector('.rw-story-beat')!;
    this.storyEyebrowEl = this.root.querySelector('.rw-story-eyebrow')!;
    this.storyTextEl = this.root.querySelector('.rw-story-text')!;
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
    this.damageFlashEl = this.root.querySelector('.rw-damage-flash')!;
    for (const id of ABILITY_SLOTS) {
      this.powerSlotEls.set(id, this.root.querySelector(`[data-ability="${id}"]`)!);
    }
    this.minimapCanvas = this.root.querySelector('.rw-minimap-canvas')!;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

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

  /** Called once, after the level exists — stores the static world-space content
   * (bounds/mountain/water) the minimap redraws every frame from updateMinimap(). Kept separate
   * from the constructor since HUD is constructed before Game.ts's own level/scene setup
   * finishes, matching showBossBar's own "set once, mid-game" pattern. Also bakes a real terrain
   * heightmap backdrop — see buildMinimapTerrainBackdrop below. */
  initMinimap(world: MinimapWorldData): void {
    this.minimapWorld = world;
    this.minimapTerrainBackdrop = this.buildMinimapTerrainBackdrop(world);
  }

  /** Real terrain contour, not a flat color wash: samples the level's own groundHeightAt() across
   * a real grid (matching the low-poly/flat-shaded aesthetic the rest of the game already uses —
   * blocky cells, not a smoothed gradient) and shades each cell by its own height, normalized
   * against the real min/max actually sampled (robust to the terrain formula ever changing) — high
   * ground reads lighter, the river's real dip reads darker. Baked once since terrain is static. */
  private buildMinimapTerrainBackdrop(world: MinimapWorldData): HTMLCanvasElement {
    const GRID = 32;
    const canvas = document.createElement('canvas');
    canvas.width = this.minimapCanvas.width;
    canvas.height = this.minimapCanvas.height;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / GRID;
    const cellH = h / GRID;

    const heights: number[] = [];
    for (let gz = 0; gz < GRID; gz++) {
      for (let gx = 0; gx < GRID; gx++) {
        const worldX = world.bounds.minX + ((gx + 0.5) / GRID) * (world.bounds.maxX - world.bounds.minX);
        const worldZ = world.bounds.minZ + ((gz + 0.5) / GRID) * (world.bounds.maxZ - world.bounds.minZ);
        heights.push(world.groundHeightAt(worldX, worldZ));
      }
    }
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    const range = max - min || 1;

    for (let gz = 0; gz < GRID; gz++) {
      for (let gx = 0; gx < GRID; gx++) {
        const t = (heights[gz * GRID + gx] - min) / range; // 0 (lowest) .. 1 (highest)
        // Real jungle-floor palette: darker mossy green at low ground (the river dip), lighter
        // toward higher terrain — same hue family as the existing water-crossing/floor colors.
        const r = Math.round(20 + t * 50);
        const g = Math.round(45 + t * 85);
        const b = Math.round(30 + t * 55);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(gx * cellW, gz * cellH, cellW + 1, cellH + 1); // +1 avoids hairline seams between cells
      }
    }
    return canvas;
  }

  /** Real world-to-canvas projection, shared by every marker updateMinimap draws — a single
   * conversion function so the player arrow and the static mountain/water markers can never
   * silently drift out of alignment with each other from two different scaling formulas. */
  private minimapProject(worldX: number, worldZ: number): { x: number; y: number } {
    const world = this.minimapWorld!;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const nx = (worldX - world.bounds.minX) / (world.bounds.maxX - world.bounds.minX);
    const nz = (worldZ - world.bounds.minZ) / (world.bounds.maxZ - world.bounds.minZ);
    return { x: nx * w, y: nz * h };
  }

  /** Driven every frame from Game.ts's animate() loop — redraws the real jungle floor, water,
   * mountain base/summit markers, and the player's own position+facing. A 150x150 canvas with a
   * handful of shapes is negligible next to the WebGL scene this HUD sits on top of, so a full
   * redraw every frame (rather than caching a static backdrop layer) keeps this method simple
   * with no real performance cost. No-ops until initMinimap() has been called once. */
  updateMinimap(playerX: number, playerZ: number, facingAngle: number): void {
    if (!this.minimapWorld) return;
    const ctx = this.minimapCtx;
    const world = this.minimapWorld;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Real terrain contour (baked once in initMinimap), not a flat wash.
    if (this.minimapTerrainBackdrop) ctx.drawImage(this.minimapTerrainBackdrop, 0, 0, w, h);

    // The living sea rings the whole island now (see createJungleLevel.ts's buildLivingSea) — a
    // real coastline band just outside the map's own bounds reads as "the world continues past
    // the edge", instead of the map silently ending at a hard black border.
    ctx.strokeStyle = 'rgba(28,74,99,0.9)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    // Compass ticks — N/E/S/W. World +Z is called "north" here purely as a fixed, consistent
    // labeling convention (matches nothing in-world, there's no real compass lore) — the point is
    // a stable reference frame the player can orient by, not a literal direction.
    ctx.fillStyle = 'rgba(238,242,230,0.55)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', w / 2, 11);
    ctx.fillText('S', w / 2, h - 4);
    ctx.textAlign = 'left';
    ctx.fillText('W', 4, h / 2 + 3);
    ctx.textAlign = 'right';
    ctx.fillText('E', w - 4, h / 2 + 3);
    ctx.textAlign = 'left';

    // The water crossing — real bounds from the level's own WaterBody, not a placeholder shape.
    const waterMin = this.minimapProject(world.water.minX, world.water.minZ);
    const waterMax = this.minimapProject(world.water.maxX, world.water.maxZ);
    ctx.fillStyle = 'rgba(111,242,255,0.28)';
    ctx.fillRect(
      Math.min(waterMin.x, waterMax.x),
      Math.min(waterMin.y, waterMax.y),
      Math.abs(waterMax.x - waterMin.x),
      Math.abs(waterMax.y - waterMin.y),
    );

    // The mountain: a line from its real base to its real summit (the winding climb path means
    // these are rarely at the exact same X/Z, which reads as a real route rather than one dot),
    // base marked in stone-grey, summit marked in the same amber the ability/legend key-badges
    // use for "the goal" — so the eye is drawn to where the climb actually ends.
    const base = this.minimapProject(world.mountainBase.x, world.mountainBase.z);
    const summit = this.minimapProject(world.mountainSummit.x, world.mountainSummit.z);
    ctx.strokeStyle = 'rgba(238,242,230,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(summit.x, summit.y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,160,160,0.9)';
    ctx.beginPath();
    ctx.arc(base.x, base.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb15e';
    ctx.beginPath();
    ctx.arc(summit.x, summit.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // The player: a real directional arrow (not a plain dot), rotated to the fox's own facing
    // angle — FoxFacing.ts's convention is angle-0-means-+Z, atan2(x,z), which is exactly the
    // rotation a canvas arrow drawn pointing toward +Y (down, i.e. +Z on this projection) needs
    // zero correction for; a positive facingAngle rotates canvas-clockwise the same direction it
    // rotates the fox's own mesh in world space.
    const player = this.minimapProject(playerX, playerZ);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(facingAngle);
    ctx.fillStyle = '#6ff2ff';
    ctx.shadowColor = 'rgba(111,242,255,0.8)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

  /** Short-lived narrative toast for a real story beat (first encounter with a species, the
   * King's own introduction, the coronation) — same restart-mid-flight pattern as
   * showAbilityUnlocked, own element/timer so a beat and an ability unlock can never stomp each
   * other if they happen to fire close together. */
  showStoryBeat(eyebrow: string, text: string): void {
    this.storyEyebrowEl.textContent = eyebrow;
    this.storyTextEl.textContent = text;

    this.storyBeatEl.classList.remove('rw-visible');
    void this.storyBeatEl.offsetWidth;
    this.storyBeatEl.classList.add('rw-visible');

    if (this.storyBeatTimer !== null) window.clearTimeout(this.storyBeatTimer);
    this.storyBeatTimer = window.setTimeout(() => {
      this.storyBeatEl.classList.remove('rw-visible');
      this.storyBeatTimer = null;
    }, 4200);
  }

  /** Fades the controls-legend panel out; called once, on the player's first real input. */
  dismissLegend(): void {
    this.controlsLegendEl.classList.add('rw-legend-hidden');
  }

  /** Short-lived toast naming the camera view mode the player just cycled into. */
  showViewMode(name: string): void {
    this.viewModeNameEl.textContent = name;

    this.viewModeToastEl.classList.remove('rw-visible');
    void this.viewModeToastEl.offsetWidth;
    this.viewModeToastEl.classList.add('rw-visible');

    if (this.viewModeToastTimer !== null) window.clearTimeout(this.viewModeToastTimer);
    this.viewModeToastTimer = window.setTimeout(() => {
      this.viewModeToastEl.classList.remove('rw-visible');
      this.viewModeToastTimer = null;
    }, 1200);
  }

  /** Reveals the boss health-bar plaque and sets the boss's name label. */
  showBossBar(name: string): void {
    this.bossNameEl.textContent = name;
    this.bossBarEl.classList.add('rw-visible');
  }

  /** Drives the boss health bar's fill width, mirroring updateHealth's clamp pattern. */
  updateBossHealth(hp: number, maxHp: number): void {
    const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
    this.bossHealthFillEl.style.setProperty('--fill', `${pct}%`);
  }

  /** Updates the objective panel's text — was previously only ever set once, at construction.
   * Replays the panel's own entry animation (rw-objective-in, `both`-filled directly on the
   * base selector, so it otherwise only ever plays once on mount) via the standard inline-
   * override + reflow trick, so a mid-game objective change reads as a real beat instead of a
   * silent text swap. */
  setObjective(text: string): void {
    this.objectiveEl.textContent = text;
    this.objectiveEl.style.animation = 'none';
    void this.objectiveEl.offsetWidth;
    this.objectiveEl.style.animation = '';
  }

  /** Full-screen red pulse for "the player just took damage"; restarts the CSS animation even
   * if a flash is already mid-flight, same reflow trick as showAbilityUnlocked. */
  flashDamage(): void {
    this.damageFlashEl.classList.remove('rw-flash-active');
    void this.damageFlashEl.offsetWidth;
    this.damageFlashEl.classList.add('rw-flash-active');
    if (this.damageFlashTimer !== null) window.clearTimeout(this.damageFlashTimer);
    this.damageFlashTimer = window.setTimeout(() => {
      this.damageFlashEl.classList.remove('rw-flash-active');
      this.damageFlashTimer = null;
    }, 320);
  }

  /** Driven every frame from AbilityKit's unlocked/cooldown state — locked/cooling-down/ready. */
  updatePowers(states: PowerSlotState[]): void {
    for (const { id, unlocked, ready } of states) {
      const el = this.powerSlotEls.get(id);
      if (!el) continue;
      el.classList.toggle('rw-power-unlocked', unlocked);
      el.classList.toggle('rw-power-ready', unlocked && ready);
    }
  }

  hideBossBar(): void {
    this.bossBarEl.classList.remove('rw-visible');
  }

  /** One-shot climax toast for the chapter's arc completion; mirrors showAbilityUnlocked's
   *  fade lifecycle but holds longer (4s vs 3s) since this is the payoff beat. */
  showArcComplete(): void {
    this.arcCompleteEl.classList.remove('rw-visible');
    void this.arcCompleteEl.offsetWidth;
    this.arcCompleteEl.classList.add('rw-visible');

    if (this.arcCompleteTimer !== null) window.clearTimeout(this.arcCompleteTimer);
    this.arcCompleteTimer = window.setTimeout(() => {
      this.arcCompleteEl.classList.remove('rw-visible');
      this.arcCompleteTimer = null;
    }, 4000);
  }

  /** The local coronation-leaderboard payoff — fires alongside showArcComplete() at the exact
   * moment the King falls (see Game.ts). `myEntry` is matched against `top` by reference so the
   * player's own row can be highlighted even if another identical-looking entry exists. */
  showCoronationResult(rank: number, top: CoronationEntry[], myEntry: CoronationEntry): void {
    const minutes = Math.floor(myEntry.coronationSeconds / 60);
    const seconds = Math.floor(myEntry.coronationSeconds % 60);
    this.coronationRankEl.textContent = `Rank #${rank}`;
    this.coronationStatsEl.textContent =
      `${minutes}:${String(seconds).padStart(2, '0')} · ${myEntry.animalsDefeated} defeated`;

    this.coronationListEl.innerHTML = '';
    top.slice(0, 5).forEach((entry, i) => {
      const li = document.createElement('li');
      if (entry === myEntry) li.classList.add('rw-coronation-me');
      const m = Math.floor(entry.coronationSeconds / 60);
      const s = Math.floor(entry.coronationSeconds % 60);
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `#${i + 1} ${SPECIES_LABELS[entry.species].name}`;
      const timeSpan = document.createElement('span');
      timeSpan.textContent = `${m}:${String(s).padStart(2, '0')}`;
      li.appendChild(nameSpan);
      li.appendChild(timeSpan);
      this.coronationListEl.appendChild(li);
    });

    this.coronationResultEl.classList.remove('rw-visible');
    void this.coronationResultEl.offsetWidth;
    this.coronationResultEl.classList.add('rw-visible');

    if (this.coronationResultTimer !== null) window.clearTimeout(this.coronationResultTimer);
    this.coronationResultTimer = window.setTimeout(() => {
      this.coronationResultEl.classList.remove('rw-visible');
      this.coronationResultTimer = null;
    }, 7000);
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
