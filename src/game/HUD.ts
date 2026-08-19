import type { CoronationEntry } from '../leaderboard/CoronationLeaderboard';
import type { DuelChat, ChatMessage } from '../multiplayer/DuelChat';
import type { DuelVoice } from '../multiplayer/DuelVoice';
import { SPECIES_LABELS } from '../scene/createPlayableCharacter';
import { ABILITIES, ABILITY_SLOTS, type Ability, type AbilityId } from './AbilityKit';
import type { PlayerAction } from './Input';

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
  private climbPromptEl: HTMLDivElement;
  private abilityToastEl: HTMLDivElement;
  private abilityNameEl: HTMLDivElement;
  private abilityDescEl: HTMLDivElement;
  private abilityToastTimer: number | null = null;
  private controlsLegendEl: HTMLDivElement;
  private legendToggleEl: HTMLButtonElement;
  private viewModeToastEl: HTMLDivElement;
  private viewModeNameEl: HTMLDivElement;
  private viewModeToastTimer: number | null = null;
  private bossBarEl: HTMLDivElement;
  private bossNameEl: HTMLSpanElement;
  private bossHealthFillEl: HTMLDivElement;
  private arcCompleteEl: HTMLDivElement;
  private arcCompleteTimer: number | null = null;
  private leaderboardViewEl: HTMLDivElement;
  private leaderboardViewListEl: HTMLOListElement;
  private duelOutcomeEl: HTMLDivElement;
  private duelOutcomeEyebrowEl: HTMLDivElement;
  private duelOutcomeTitleEl: HTMLDivElement;
  private duelOutcomeTimer: number | null = null;
  private duelChatEl: HTMLDivElement;
  private duelChatListEl: HTMLOListElement;
  private duelChatInputEl: HTMLInputElement;
  private duelVoiceBadgeEl: HTMLDivElement;
  private duelVoiceStatusEl: HTMLSpanElement;
  private duelVoiceMuteBtn: HTMLButtonElement;
  private duelVoiceAudioEl: HTMLAudioElement;
  private coronationResultEl: HTMLDivElement;
  private coronationRankEl: HTMLDivElement;
  private coronationStatsEl: HTMLDivElement;
  private coronationListEl: HTMLOListElement;
  private coronationResultTimer: number | null = null;
  private storyBeatEl: HTMLDivElement;
  private storyEyebrowEl: HTMLDivElement;
  private storyTextEl: HTMLDivElement;
  private storyBeatTimer: number | null = null;
  private damageFlashEl: HTMLDivElement;
  private damageFlashTimer: number | null = null;
  private koFlashEl: HTMLDivElement;
  private koFlashTimer: number | null = null;
  private powerSlotEls: Map<AbilityId, HTMLDivElement> = new Map();
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private minimapWorld: MinimapWorldData | null = null;
  // Baked once in initMinimap() from a real sampled heightmap — terrain never changes at runtime,
  // so redrawing it from scratch every frame (like the rest of the minimap) would be pure waste.
  private minimapTerrainBackdrop: HTMLCanvasElement | null = null;

  constructor(container: HTMLElement, isTouchPrimary = false) {
    this.root = document.createElement('div');
    // Real layout accommodation, not cosmetic: TouchControls.ts mounts a joystick + button
    // cluster over the same bottom-left/bottom-right corners the power bar and prompts already
    // occupy on desktop — see the .rw-touch power-bar rule below.
    if (isTouchPrimary) this.root.classList.add('rw-touch');
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
      <div class="rw-ko-flash"></div>
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
        <span class="rw-hunt-key">L</span>
        <span class="rw-hunt-label">Pounce</span>
      </div>
      <div class="rw-climb-prompt">
        <span class="rw-climb-key">W</span>
        <span class="rw-climb-label">Climb</span>
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
      <div class="rw-duel-outcome">
        <div class="rw-arc-eyebrow rw-duel-eyebrow"></div>
        <div class="rw-arc-title rw-duel-title"></div>
      </div>
      <div class="rw-duel-chat">
        <div class="rw-duel-voice-badge">
          <span class="rw-duel-voice-status"></span>
          <button class="rw-duel-voice-mute" type="button">Y to mute</button>
        </div>
        <ol class="rw-duel-chat-list"></ol>
        <input class="rw-duel-chat-input" type="text" maxlength="200" placeholder="T to chat, Enter to send" autocomplete="off" />
        <audio class="rw-duel-voice-audio" autoplay></audio>
      </div>
      <div class="rw-leaderboard-view">
        <div class="rw-lb-header">
          <span class="rw-lb-title">Kings of the Mountain</span>
          <span class="rw-lb-hint">O to close</span>
        </div>
        <ol class="rw-lb-list"></ol>
        <div class="rw-lb-note">Shared peer-to-peer with everyone online now — encrypted on your device.</div>
      </div>
      <div class="rw-coronation-result">
        <div class="rw-coronation-eyebrow">Coronation Record</div>
        <div class="rw-coronation-rank"></div>
        <div class="rw-coronation-stats"></div>
        <ol class="rw-coronation-list"></ol>
        <div class="rw-coronation-note">Shared peer-to-peer with everyone online now — encrypted on your device.</div>
      </div>
      <button type="button" class="rw-legend-toggle" aria-label="Show controls">?</button>
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
        <div class="rw-legend-row"><span class="rw-legend-key">1 – 0</span><span class="rw-legend-label">Powers</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">M</span><span class="rw-legend-label">Challenge</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">O</span><span class="rw-legend-label">Leaderboard</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">T</span><span class="rw-legend-label">Duel Chat</span></div>
        <div class="rw-legend-row"><span class="rw-legend-key">Y</span><span class="rw-legend-label">Duel Mute</span></div>
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
        position: fixed; bottom: 82px; left: 50%; transform: translateX(-50%); z-index: 10;
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

      /* Climb prompt: real, previously-missing guidance — a player standing at the mountain's
         real jagged rock-face walls had zero on-screen indication that walking forward would
         start a climb (only the hunt system had this kind of near-interactable prompt). Same
         plaque treatment as the hunt prompt, always at "ready" glow since climbing has no
         readiness gate — being in range IS being able to climb. */
      .rw-climb-prompt {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 10;
        pointer-events: none; display: none; align-items: center; gap: 8px;
        font-family: var(--body-face); color: var(--parchment);
        padding: 7px 16px 6px;
        background: linear-gradient(180deg, rgba(20,13,9,0.6), rgba(7,10,8,0.78));
        border-top: 1px solid rgba(111,242,255,0.55);
        box-shadow: 0 0 18px rgba(111,242,255,0.3);
        clip-path: polygon(6% 0, 94% 0, 100% 100%, 0% 100%);
      }
      .rw-climb-prompt.rw-visible {
        display: flex;
        animation: rw-objective-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-climb-key {
        font-family: var(--mono-face); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
        padding: 2px 7px; border-radius: 3px; line-height: 1.5;
        background: rgba(111,242,255,0.16); border: 1px solid rgba(111,242,255,0.55); color: var(--myth-cyan);
      }
      .rw-climb-label { text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; opacity: 0.85; }
      @media (prefers-reduced-motion: reduce) {
        .rw-climb-prompt.rw-visible { animation: none; }
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
      /* Real duel-outcome toast: same centered climax-beat position/lifecycle as arc-complete
         (mutually exclusive with it — a duel never fires alongside the AI King fight, so sharing
         the visual slot is safe), but its own real win/lose framing set dynamically at call time
         (see showDuelOutcome) rather than the fixed "Arc Complete" copy. A real color split — a
         win reuses the same amber the coronation-result panel uses, a loss reads in a duller
         red — so the two outcomes are visually distinct at a glance, not just by text. */
      .rw-duel-outcome {
        position: fixed; top: 50%; left: 50%; z-index: 16;
        display: none; pointer-events: none; text-align: center;
        font-family: var(--body-face); color: var(--parchment);
        min-width: 260px; max-width: min(420px, 88vw);
        padding: 16px 32px 14px;
        background: linear-gradient(180deg, rgba(20,13,9,0.8), rgba(7,10,8,0.94));
        border-top: 1px solid rgba(255,177,94,0.6);
        box-shadow: 0 0 32px rgba(255,177,94,0.4), 0 18px 44px rgba(0,0,0,0.55);
        clip-path: polygon(3% 0, 97% 0, 100% 100%, 0% 100%);
      }
      .rw-duel-outcome.rw-duel-lost {
        border-top-color: rgba(217,102,122,0.6);
        box-shadow: 0 0 32px rgba(217,102,122,0.3), 0 18px 44px rgba(0,0,0,0.55);
      }
      .rw-duel-outcome.rw-visible {
        display: block;
        animation: rw-arc-complete-toast 4500ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-duel-eyebrow { color: var(--spirit-amber); }
      .rw-duel-outcome.rw-duel-lost .rw-duel-eyebrow { color: var(--vitality-low); }
      .rw-duel-title { text-shadow: 0 0 18px rgba(255,177,94,0.45); }
      .rw-duel-outcome.rw-duel-lost .rw-duel-title { text-shadow: 0 0 18px rgba(217,102,122,0.4); }

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

      /* Real on-demand leaderboard view (KeyO) — deliberately NOT a timed toast like
         coronation-result: a player checking standings mid-game needs to actually read it, not
         watch it fade after a few seconds, so this stays open until explicitly closed. Centered,
         same carved-bark/amber design language as every other panel in this file. */
      .rw-leaderboard-view {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 17;
        display: none; pointer-events: none; text-align: left;
        font-family: var(--body-face); color: var(--parchment);
        width: min(340px, 88vw);
        padding: 18px 22px 16px;
        background: linear-gradient(180deg, rgba(20,13,9,0.9), rgba(7,10,8,0.97));
        border-top: 1px solid rgba(255,177,94,0.6);
        box-shadow: 0 0 36px rgba(255,177,94,0.25), 0 20px 48px rgba(0,0,0,0.6);
        clip-path: polygon(2% 0, 98% 0, 100% 100%, 0% 100%);
      }
      .rw-leaderboard-view.rw-visible { display: block; }
      .rw-lb-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
      .rw-lb-title { font-family: var(--display-face); font-weight: 600; font-size: 18px; }
      .rw-lb-hint { font-size: 10px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.08em; }
      .rw-lb-list { list-style: none; margin: 0 0 10px; padding: 0; font-family: var(--mono-face); font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
      .rw-lb-list li { display: flex; justify-content: space-between; opacity: 0.85; }
      .rw-lb-list li:first-child { color: var(--spirit-amber); opacity: 1; }
      .rw-lb-note { font-size: 9px; opacity: 0.5; font-style: italic; }

      /* Real 1:1 duel chat (KeyT) — bottom-left, only visible during a live duel (Game.ts calls
         showDuelChat/hideDuelChat on duel start/end). Deliberately small and unobtrusive: this
         rides the same P2P connection as the fight itself, not a full-screen takeover. */
      .rw-duel-chat {
        position: fixed; left: 16px; bottom: 16px; z-index: 16;
        display: none; flex-direction: column; gap: 6px;
        width: min(280px, 70vw);
        font-family: var(--body-face); color: var(--parchment);
      }
      .rw-duel-chat.rw-visible { display: flex; }
      .rw-duel-voice-badge { display: none; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; opacity: 0.85; }
      .rw-duel-voice-badge.rw-visible { display: flex; }
      .rw-duel-voice-mute {
        font-family: var(--body-face); font-size: 10px; padding: 3px 8px; cursor: pointer;
        background: rgba(7,10,8,0.75); color: var(--parchment); border: 1px solid rgba(238,242,230,0.25); border-radius: 4px;
      }
      .rw-duel-voice-mute:hover { background: rgba(238,242,230,0.1); }
      .rw-duel-voice-mute.rw-voice-muted { color: var(--spirit-amber); border-color: rgba(255,177,94,0.5); }
      .rw-duel-chat-list {
        list-style: none; margin: 0; padding: 8px 10px; max-height: 120px; overflow-y: auto;
        display: flex; flex-direction: column; gap: 3px; font-size: 12px;
        background: rgba(7,10,8,0.75); border-left: 2px solid rgba(255,177,94,0.4); border-radius: 4px;
      }
      .rw-duel-chat-list li { opacity: 0.9; word-break: break-word; }
      .rw-duel-chat-list li.rw-chat-me { color: var(--spirit-amber); }
      .rw-duel-chat-input {
        font-family: var(--body-face); font-size: 12px; padding: 6px 10px;
        background: rgba(7,10,8,0.75); color: var(--parchment);
        border: 1px solid rgba(238,242,230,0.2); border-radius: 4px;
      }
      .rw-duel-chat-input:focus { outline: none; border-color: rgba(255,177,94,0.6); }

      /* Controls legend: previously dumped all 13 keybind rows on screen the instant the game
         loaded, then vanished forever on the player's first move — real usability flaw (forget
         a keybind 20 minutes in and there was no way to check it again), and the biggest single
         source of first-impression clutter. Redesigned as a real reference, not a one-shot
         intro: a small carved-plaque "?" toggle sits permanently in the same corner (same
         idle-amber key-badge language as rw-hunt-key), and the full row list only exists while
         open. rw-legend-attract is a brief, self-clearing pulse (not a loop) so a fresh player
         notices the toggle without it nagging for the rest of the run. */
      .rw-legend-toggle {
        position: fixed; top: 20px; right: 20px; z-index: 11;
        width: 30px; height: 30px; padding: 0;
        font-family: var(--display-face); font-size: 15px; line-height: 1; color: var(--parchment);
        background: linear-gradient(180deg, rgba(20,13,9,0.68), rgba(7,10,8,0.84));
        border: 1px solid rgba(255,177,94,0.4); border-radius: 4px;
        box-shadow: 0 0 12px rgba(0,0,0,0.35);
        cursor: pointer;
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }
      .rw-legend-toggle:hover, .rw-legend-toggle.rw-legend-open-state {
        border-color: rgba(255,177,94,0.7);
        box-shadow: 0 0 14px rgba(255,177,94,0.28);
      }
      .rw-legend-toggle.rw-legend-attract {
        animation: rw-legend-attract-pulse 1400ms ease-out 2;
      }
      @keyframes rw-legend-attract-pulse {
        0%, 100% { box-shadow: 0 0 12px rgba(0,0,0,0.35); border-color: rgba(255,177,94,0.4); }
        50% { box-shadow: 0 0 18px rgba(255,177,94,0.5); border-color: rgba(255,177,94,0.85); }
      }

      .rw-controls-legend {
        position: fixed; top: 58px; right: 20px; z-index: 10;
        pointer-events: none; text-align: right;
        font-family: var(--body-face); color: var(--parchment);
        padding: 10px 18px 10px;
        background: linear-gradient(180deg, rgba(20,13,9,0.62), rgba(7,10,8,0.8));
        border-top: 1px solid rgba(255,177,94,0.32);
        box-shadow: 0 0 20px rgba(0,0,0,0.4);
        clip-path: polygon(6% 0, 94% 0, 100% 100%, 0% 100%);
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .rw-controls-legend.rw-legend-open {
        opacity: 0.96;
        transform: translateY(0);
        pointer-events: auto;
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
        .rw-legend-toggle.rw-legend-attract { animation: none; }
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

      /* KO flash: a real distinct amber/gold vignette punch — the killing-blow cue, deliberately
         a different color and a sharper attack than the red damage-flash so a kill never reads as
         "just another hit." Pairs with AudioFX.playKnockout(). */
      .rw-ko-flash {
        position: fixed; inset: 0; z-index: 18; pointer-events: none;
        opacity: 0;
        background: radial-gradient(ellipse at center, rgba(255,177,94,0) 35%, rgba(255,177,94,0.45) 100%);
      }
      .rw-ko-flash.rw-flash-active {
        animation: rw-ko-flash 280ms ease-out;
      }
      @keyframes rw-ko-flash {
        0% { opacity: 0; }
        12% { opacity: 1; }
        100% { opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rw-ko-flash.rw-flash-active { animation: none; }
      }

      /* Power bar: all 10 ability slots, bottom-left — same carved-plaque key-badge language as
         the controls legend (rw-legend-key), so activatable powers read as part of the same
         instrument family rather than a new UI language. Locked slots collapse to a small numbered
         pip (see the :not(.rw-power-unlocked) rule above) so a fresh player sees ten quiet marks,
         not ten full-width name cards — the bar only grows wide as abilities are actually earned.
         Ready slots get the myth-cyan "charged" treatment vitality/hunt-prompt already use.
         flex-wrap + the viewport-relative max-width: wrapping to a second row (growing upward,
         since only bottom is anchored) reads fine here and avoids slots running off the right
         edge of the screen on narrow viewports. */
      .rw-power-bar {
        position: fixed; bottom: 26px; left: 20px; z-index: 10;
        pointer-events: none; display: flex; flex-wrap: wrap; gap: 8px;
        max-width: calc(100vw - 40px);
        font-family: var(--body-face); color: var(--parchment);
      }
      /* TouchControls.ts mounts a real joystick over this exact bottom-left corner on
         touch-primary devices — shift the bar up clear of it rather than let the two overlap. */
      .rw-touch .rw-power-bar { bottom: 150px; }
      .rw-power-slot {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        padding: 6px 8px 5px; min-width: 28px;
        background: linear-gradient(180deg, rgba(20,13,9,0.55), rgba(7,10,8,0.72));
        border-top: 1px solid rgba(238,242,230,0.14);
        clip-path: polygon(10% 0, 90% 0, 100% 100%, 0% 100%);
        opacity: 0.32;
        transition: opacity 160ms ease, border-color 160ms ease, box-shadow 160ms ease, min-width 160ms ease, padding 160ms ease;
        cursor: pointer;
      }
      /* A locked slot is a blank stone totem — key number only, no name. The real ability name
         (e.g. "Shark Bite") only carves itself in once earned, which doubles as a small, honest
         discovery beat: the power bar tells you HOW MANY abilities exist before you've unlocked
         any of them, but not WHAT they are, matching how the wild-form field notes already
         withhold ability names until a species is actually eaten (see CharacterSelect.ts). */
      .rw-power-slot:not(.rw-power-unlocked) .rw-power-name { display: none; }
      .rw-power-slot.rw-power-unlocked {
        opacity: 0.55;
        min-width: 54px; padding: 6px 10px 5px;
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
    this.climbPromptEl = this.root.querySelector('.rw-climb-prompt')!;
    this.abilityToastEl = this.root.querySelector('.rw-ability-toast')!;
    this.abilityNameEl = this.root.querySelector('.rw-ability-name')!;
    this.abilityDescEl = this.root.querySelector('.rw-ability-desc')!;
    this.controlsLegendEl = this.root.querySelector('.rw-controls-legend')!;
    this.legendToggleEl = this.root.querySelector('.rw-legend-toggle')!;
    // Self-contained UI concern — no gameplay state, so it's wired here rather than routed
    // through Game.ts the way every other HUD update is (those all reflect real game state).
    this.legendToggleEl.addEventListener('click', () => {
      const open = this.controlsLegendEl.classList.toggle('rw-legend-open');
      this.legendToggleEl.classList.toggle('rw-legend-open-state', open);
    });
    // A brief, self-clearing pulse — not a loop — so a fresh player notices the toggle exists
    // without it nagging for the rest of the run.
    this.legendToggleEl.classList.add('rw-legend-attract');
    window.setTimeout(() => this.legendToggleEl.classList.remove('rw-legend-attract'), 3000);
    this.viewModeToastEl = this.root.querySelector('.rw-view-mode-toast')!;
    this.viewModeNameEl = this.root.querySelector('.rw-view-mode-name')!;
    this.bossBarEl = this.root.querySelector('.rw-boss-bar')!;
    this.bossNameEl = this.root.querySelector('.rw-boss-name')!;
    this.bossHealthFillEl = this.root.querySelector('.rw-boss-fill')!;
    this.arcCompleteEl = this.root.querySelector('.rw-arc-complete')!;
    this.leaderboardViewEl = this.root.querySelector('.rw-leaderboard-view')!;
    this.leaderboardViewListEl = this.root.querySelector('.rw-lb-list')!;
    this.duelOutcomeEl = this.root.querySelector('.rw-duel-outcome')!;
    this.duelChatEl = this.root.querySelector('.rw-duel-chat')!;
    this.duelChatListEl = this.root.querySelector('.rw-duel-chat-list')!;
    this.duelChatInputEl = this.root.querySelector('.rw-duel-chat-input')!;
    this.duelVoiceBadgeEl = this.root.querySelector('.rw-duel-voice-badge')!;
    this.duelVoiceStatusEl = this.root.querySelector('.rw-duel-voice-status')!;
    this.duelVoiceMuteBtn = this.root.querySelector('.rw-duel-voice-mute')!;
    this.duelVoiceAudioEl = this.root.querySelector('.rw-duel-voice-audio')!;
    this.duelOutcomeEyebrowEl = this.root.querySelector('.rw-duel-eyebrow')!;
    this.duelOutcomeTitleEl = this.root.querySelector('.rw-duel-title')!;
    this.coronationResultEl = this.root.querySelector('.rw-coronation-result')!;
    this.coronationRankEl = this.root.querySelector('.rw-coronation-rank')!;
    this.coronationStatsEl = this.root.querySelector('.rw-coronation-stats')!;
    this.coronationListEl = this.root.querySelector('.rw-coronation-list')!;
    this.storyBeatEl = this.root.querySelector('.rw-story-beat')!;
    this.storyEyebrowEl = this.root.querySelector('.rw-story-eyebrow')!;
    this.storyTextEl = this.root.querySelector('.rw-story-text')!;
    this.damageFlashEl = this.root.querySelector('.rw-damage-flash')!;
    this.koFlashEl = this.root.querySelector('.rw-ko-flash')!;
    for (const id of ABILITY_SLOTS) {
      this.powerSlotEls.set(id, this.root.querySelector(`[data-ability="${id}"]`)!);
    }
    this.minimapCanvas = this.root.querySelector('.rw-minimap-canvas')!;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
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

  /** Real, previously-missing guidance — driven every frame by Game.ts's near-wall check. */
  showClimbPrompt() {
    this.climbPromptEl.classList.add('rw-visible');
  }

  hideClimbPrompt() {
    this.climbPromptEl.classList.remove('rw-visible');
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

  /** Full-screen amber/gold pulse for "that hit just killed something" — a real distinct beat
   * from flashDamage() (different color, sharper attack) so a kill reads as decisive, not just
   * another hit. Same restart-mid-flight trick. Pairs with AudioFX.playKnockout(). */
  flashKO(): void {
    this.koFlashEl.classList.remove('rw-flash-active');
    void this.koFlashEl.offsetWidth;
    this.koFlashEl.classList.add('rw-flash-active');
    if (this.koFlashTimer !== null) window.clearTimeout(this.koFlashTimer);
    this.koFlashTimer = window.setTimeout(() => {
      this.koFlashEl.classList.remove('rw-flash-active');
      this.koFlashTimer = null;
    }, 280);
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

  /** Real touch parity: the power-bar slots and hunt prompt already exist as the desktop UI's own
   * visual reference for "which key does this" — rather than build a second, redundant set of
   * touch-only ability buttons, this makes the SAME elements real tap targets, firing through the
   * exact PlayerAction union every keyboard shortcut already emits (so Game.ts's one onAction
   * switchboard, and every gating check inside tryActivateAbility/tryPounce, covers touch for
   * free). Climb has no discrete action to wire — see Game.ts's own rawMoveInput.z>0 gate, already
   * satisfied by TouchControls.ts's joystick with zero extra code. */
  wireTouchTaps(onAction: (action: PlayerAction) => void): void {
    ABILITY_SLOTS.forEach((id, index) => {
      const el = this.powerSlotEls.get(id);
      if (!el) return;
      el.style.pointerEvents = 'auto';
      el.addEventListener('pointerdown', () => onAction(`ability${index + 1}` as PlayerAction));
    });
    this.huntPromptEl.style.pointerEvents = 'auto';
    this.huntPromptEl.style.cursor = 'pointer';
    this.huntPromptEl.addEventListener('pointerdown', () => onAction('pounce'));
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

  /** Real on-demand leaderboard browsing (KeyO) — unlike showCoronationResult's timed toast,
   * this stays open until the player explicitly closes it (same key toggles it shut), since
   * checking standings mid-game means actually reading it, not glancing at a fading toast. */
  toggleLeaderboardView(entries: (CoronationEntry & { playerName?: string })[]): void {
    const opening = !this.leaderboardViewEl.classList.contains('rw-visible');
    if (!opening) {
      this.leaderboardViewEl.classList.remove('rw-visible');
      return;
    }
    this.leaderboardViewListEl.innerHTML = '';
    entries.slice(0, 10).forEach((entry, i) => {
      const li = document.createElement('li');
      const m = Math.floor(entry.coronationSeconds / 60);
      const s = Math.floor(entry.coronationSeconds % 60);
      const nameSpan = document.createElement('span');
      const label = entry.playerName
        ? `${entry.playerName} · ${SPECIES_LABELS[entry.species].name}`
        : SPECIES_LABELS[entry.species].name;
      nameSpan.textContent = `#${i + 1} ${label}`;
      const timeSpan = document.createElement('span');
      timeSpan.textContent = `${m}:${String(s).padStart(2, '0')}`;
      li.appendChild(nameSpan);
      li.appendChild(timeSpan);
      this.leaderboardViewListEl.appendChild(li);
    });
    this.leaderboardViewEl.classList.add('rw-visible');
  }

  private renderDuelChat(messages: ChatMessage[]): void {
    this.duelChatListEl.innerHTML = '';
    for (const msg of messages.slice(-30)) {
      const li = document.createElement('li');
      li.textContent = msg.from === 'me' ? `You: ${msg.text}` : `Opponent: ${msg.text}`;
      if (msg.from === 'me') li.classList.add('rw-chat-me');
      this.duelChatListEl.appendChild(li);
    }
    this.duelChatListEl.scrollTop = this.duelChatListEl.scrollHeight;
  }

  /** Wires the real duel-scoped chat panel (KeyT to focus, Enter to send) for the lifetime of one
   * duel — see DuelChat.ts for why this is 1:1 over the fight's own connection, not a mesh chat. */
  showDuelChat(chat: DuelChat): void {
    this.renderDuelChat(chat.history);
    chat.onUpdate((messages) => this.renderDuelChat(messages));
    this.duelChatInputEl.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      chat.send(this.duelChatInputEl.value);
      this.duelChatInputEl.value = '';
      this.duelChatInputEl.blur();
    };
    this.duelChatEl.classList.add('rw-visible');
  }

  hideDuelChat(): void {
    this.duelChatEl.classList.remove('rw-visible');
    this.duelChatListEl.innerHTML = '';
    this.duelChatInputEl.value = '';
    this.duelChatInputEl.onkeydown = null;
  }

  // Regression: a literal "t" used to leak into the box on every open — see Input.ts's own
  // preventDefault() on the KeyT keydown for why focusing synchronously here is now safe (the
  // browser's default text-insertion for that keystroke is suppressed at the source, so there's
  // no race to defer around, and subsequent real keystrokes land in the input immediately).
  focusDuelChatInput(): void {
    this.duelChatInputEl.focus();
  }

  private voiceMuteToggle: (() => void) | null = null;

  /** Wires the real duel-scoped voice badge/mute button and attaches incoming remote audio to a
   * real <audio> element for playback — see DuelVoice.ts for why this is 1:1 over the fight's own
   * connection, not a mesh call. */
  showDuelVoice(voice: DuelVoice): void {
    const apply = (muted: boolean) => {
      this.duelVoiceStatusEl.textContent = muted ? 'Mic muted' : 'Mic live';
      this.duelVoiceMuteBtn.textContent = muted ? 'Y to unmute' : 'Y to mute';
      this.duelVoiceMuteBtn.classList.toggle('rw-voice-muted', muted);
    };
    apply(voice.isMuted);
    this.voiceMuteToggle = () => apply(voice.toggleMute());
    this.duelVoiceMuteBtn.onclick = () => this.voiceMuteToggle?.();
    voice.onRemoteStream((stream) => {
      this.duelVoiceAudioEl.srcObject = stream;
    });
    this.duelVoiceBadgeEl.classList.add('rw-visible');
  }

  hideDuelVoice(): void {
    this.duelVoiceBadgeEl.classList.remove('rw-visible');
    this.duelVoiceMuteBtn.onclick = null;
    this.voiceMuteToggle = null;
    this.duelVoiceAudioEl.srcObject = null;
  }

  toggleDuelVoiceMute(): void {
    this.voiceMuteToggle?.();
  }

  /** A real distinct PvP-duel outcome beat — shown to BOTH players (winner and loser see their
   * own real framing, not a shared "arc complete" line meant for the single-player King fight).
   * A win still fires showCoronationResult() alongside this for the leaderboard payoff; a loss
   * gets no leaderboard entry at all, just this toast. */
  showDuelOutcome(won: boolean): void {
    this.duelOutcomeEyebrowEl.textContent = won ? 'The Throne Is Claimed' : 'Single Combat';
    this.duelOutcomeTitleEl.textContent = won
      ? 'You have defeated your challenger'
      : 'You have been defeated — the throne remains contested';
    this.duelOutcomeEl.classList.toggle('rw-duel-lost', !won);

    this.duelOutcomeEl.classList.remove('rw-visible');
    void this.duelOutcomeEl.offsetWidth;
    this.duelOutcomeEl.classList.add('rw-visible');

    if (this.duelOutcomeTimer !== null) window.clearTimeout(this.duelOutcomeTimer);
    this.duelOutcomeTimer = window.setTimeout(() => {
      this.duelOutcomeEl.classList.remove('rw-visible');
      this.duelOutcomeTimer = null;
    }, 4500);
  }

  /** The local coronation-leaderboard payoff — fires alongside showArcComplete() at the exact
   * moment the King falls (see Game.ts). `myEntry` is matched against `top` by reference so the
   * player's own row can be highlighted even if another identical-looking entry exists. */
  showCoronationResult(
    rank: number,
    top: (CoronationEntry & { playerId?: string; playerName?: string })[],
    myEntry: CoronationEntry & { playerId?: string },
  ): void {
    const minutes = Math.floor(myEntry.coronationSeconds / 60);
    const seconds = Math.floor(myEntry.coronationSeconds % 60);
    this.coronationRankEl.textContent = `Rank #${rank}`;
    this.coronationStatsEl.textContent =
      `${minutes}:${String(seconds).padStart(2, '0')} · ${myEntry.animalsDefeated} defeated`;

    this.coronationListEl.innerHTML = '';
    top.slice(0, 5).forEach((entry, i) => {
      const li = document.createElement('li');
      // World entries are distinct objects reconstructed from network/decrypt, so reference
      // equality (the old single-device check) no longer reliably finds "me" — playerId does.
      const isMe = entry === myEntry || (!!entry.playerId && entry.playerId === myEntry.playerId);
      if (isMe) li.classList.add('rw-coronation-me');
      const m = Math.floor(entry.coronationSeconds / 60);
      const s = Math.floor(entry.coronationSeconds % 60);
      const nameSpan = document.createElement('span');
      const label = entry.playerName
        ? `${entry.playerName} · ${SPECIES_LABELS[entry.species].name}`
        : SPECIES_LABELS[entry.species].name;
      nameSpan.textContent = `#${i + 1} ${label}`;
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

}
