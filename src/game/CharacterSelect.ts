import * as THREE from 'three';
import { SPECIES_SKINS, SPECIES_LABELS, createPlayableCharacter } from '../scene/createPlayableCharacter';
import type { SpeciesId, PlayableCharacter } from '../scene/PlayableCharacter';
import { ABILITIES, type AbilityId } from './AbilityKit';
import { AudioFX } from './Audio';

export const SPECIES_ORDER: SpeciesId[] = ['fox', 'bear', 'viper', 'boar', 'lion', 'crocodile', 'owl'];

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

interface WildFieldNote {
  hp: number;
  biteDamage: number;
  abilityId: AbilityId;
}

// Real numbers, not invented for this screen — transcribed from the exact tuning that drives
// combat: each entity's own `hp:` literal (tuskBoar.ts/createGroveBear.ts/createLion.ts/
// createCrocodile.ts/createVineViper.ts) and Game.ts's own *_HIT_DAMAGE consts. Not imported
// directly, since Game.ts doesn't export those as reusable constants and is already a very large
// file — if combat tuning changes, update both sides together.
const WILD_FIELD_NOTES: Partial<Record<SpeciesId, WildFieldNote>> = {
  bear: { hp: 90, biteDamage: 16, abilityId: 'bear-swipe' },
  viper: { hp: 26, biteDamage: 9, abilityId: 'viper-venom' },
  boar: { hp: 68, biteDamage: 14, abilityId: 'boar-charge' },
  lion: { hp: 100, biteDamage: 18, abilityId: 'lion-pounce' },
  crocodile: { hp: 60, biteDamage: 15, abilityId: 'croc-lunge' },
  owl: { hp: 34, biteDamage: 10, abilityId: 'owl-dive' },
  // fox has no entry: it's never a huntable wild NPC in this game (see createJungleLevel.ts's
  // wildlife spawns), so there's no real wild-form stat to show — renderFieldNotes special-cases it.
};

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

/** Pre-game species + skin picker. Builds its own standalone DOM/CSS directly into `container`
 * (HUD/Game don't exist yet at this point in main.ts's boot sequence, so there is nothing to
 * reuse them through) and resolves once the player confirms — tearing its own markup and
 * `<style>` block out of the document before resolving, so nothing lingers to fight HUD's own
 * `:root` custom-property block once Game mounts next. Reuses the exact same design tokens
 * (colors/fonts) HUD.ts's `:root` block defines, so the transition from this screen into the
 * game reads as one continuous piece of UI, not a placeholder bolted onto the front.
 *
 * Class-shaped (not a plain function) for the same reason HUD.ts is a class: internal refs
 * (cardEls, swatchEl, speciesIndex...) are stored as fields a test can reach into via
 * `(instance as any).xxxEl`, the same fake-DOM-harness pattern HUD.controlsLegend.test.ts
 * already established — a plain closure-only function would hide that state from tests
 * entirely. */
export class CharacterSelect {
  private root: HTMLDivElement;
  private cardEls: HTMLButtonElement[];
  private swatchEl: HTMLSpanElement;
  private skinNameEl: HTMLSpanElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private beginBtn: HTMLButtonElement;
  private fieldNotesEl: HTMLDivElement;

  // Real live 3D render preview, not a static portrait — reuses the exact same
  // createPlayableCharacter() the actual game uses, so what the player sees here is the real
  // model, real proportions, real skin colors. Guarded behind a real-WebGL check: this project's
  // own tests run against a bare fake-DOM with no jsdom/WebGL global at all (see this file's own
  // test's comment), so `typeof WebGLRenderingContext` is the same environment-detection pattern
  // already used for the audio preview below.
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewCharacter: PlayableCharacter | null = null;
  private previewRafId: number | null = null;
  private previewStart = 0;

  private speciesIndex = 0;
  private skinIndexBySpecies: Record<SpeciesId, number> = {
    fox: 0,
    bear: 0,
    viper: 0,
    boar: 0,
    lion: 0,
    crocodile: 0,
    owl: 0,
  };
  // Real voice preview on card selection — previously this screen only showed name/blurb/skin
  // swatch, none of a real animal's own identity that the game already gives every species
  // elsewhere (see Audio.ts's per-species hurt/death/aggro cues). AudioFX itself is always safe
  // to construct (no AudioContext is created until .unlock()), but this project deliberately runs
  // its tests against a bare fake-DOM with no AudioContext global at all (see
  // CharacterSelect.test.ts's own comment) — guarding the actual unlock+play behind a real
  // environment check keeps every existing card-click test working unchanged.
  private audio = typeof AudioContext !== 'undefined' ? new AudioFX() : null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'rw-charselect';
    this.root.innerHTML = `
      <style>
        .rw-charselect {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 50% 40%, #14231a 0%, #070a08 75%);
          font-family: var(--body-face, ui-sans-serif, system-ui, sans-serif);
          color: var(--parchment, #eef2e6);
          animation: rw-cs-fade-in 420ms ease-out both;
        }
        @keyframes rw-cs-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .rw-cs-panel { display: flex; flex-direction: column; align-items: center; gap: 28px; max-width: 720px; padding: 32px; }
        .rw-cs-title {
          font-family: var(--display-face, ui-serif, Georgia, serif);
          font-size: 34px; letter-spacing: 0.02em; color: var(--parchment, #eef2e6);
          text-shadow: 0 0 24px rgba(111,242,255,0.25);
        }
        .rw-cs-subtitle { font-size: 14px; opacity: 0.7; margin-top: -18px; text-align: center; }
        .rw-cs-cards { display: flex; gap: 18px; }
        .rw-cs-preview-row { display: flex; align-items: center; gap: 22px; }
        .rw-cs-preview-canvas {
          width: 168px; height: 168px; border-radius: 12px;
          border: 2px solid rgba(238,242,230,0.14);
          background: radial-gradient(circle at 50% 32%, rgba(111,242,255,0.1), rgba(7,10,8,0.4) 75%);
        }
        .rw-cs-fieldnotes { max-width: 280px; font-size: 12px; line-height: 1.55; text-align: left; }
        .rw-cs-fn-stats { opacity: 0.85; margin-bottom: 6px; }
        .rw-cs-fn-skill { opacity: 0.7; }
        .rw-cs-fn-skill strong { color: var(--spirit-amber, #ffb15e); font-weight: 600; }
        .rw-cs-card {
          width: 190px; padding: 18px 16px; border-radius: 10px;
          border: 2px solid rgba(238,242,230,0.14);
          background: rgba(20,13,9,0.55);
          cursor: pointer; text-align: center;
          transition: border-color 180ms ease, transform 180ms ease, background 180ms ease;
          font: inherit; color: inherit; /* real <button> now, not a div — reset UA button chrome */
        }
        .rw-cs-card:focus-visible {
          outline: 2px solid var(--spirit-amber, #ffb15e); outline-offset: 2px;
        }
        .rw-cs-card:hover { transform: translateY(-3px); }
        .rw-cs-card.rw-cs-selected {
          border-color: var(--spirit-amber, #ffb15e);
          background: rgba(255,177,94,0.1);
          box-shadow: 0 0 22px rgba(255,177,94,0.25);
        }
        .rw-cs-species-name { font-family: var(--display-face, ui-serif, Georgia, serif); font-size: 20px; margin-bottom: 6px; }
        .rw-cs-blurb { font-size: 12px; line-height: 1.4; opacity: 0.75; min-height: 48px; }
        .rw-cs-skin-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 24px; }
        .rw-cs-swatch {
          width: 46px; height: 46px; border-radius: 50%;
          border: 2px solid rgba(238,242,230,0.35);
          box-shadow: 0 0 16px 2px var(--swatch-glow, transparent);
          transition: box-shadow 220ms ease;
        }
        .rw-cs-skin-name { min-width: 150px; font-size: 13px; text-align: center; }
        .rw-cs-skin-btn {
          background: transparent; border: 1px solid rgba(238,242,230,0.3); color: var(--parchment, #eef2e6);
          border-radius: 6px; width: 30px; height: 30px; cursor: pointer; font-size: 15px; line-height: 1;
        }
        .rw-cs-skin-btn:hover { background: rgba(255,177,94,0.2); }
        .rw-cs-begin {
          margin-top: 10px; padding: 12px 34px; border-radius: 8px; border: none; cursor: pointer;
          font-family: var(--display-face, ui-serif, Georgia, serif); font-size: 16px; letter-spacing: 0.03em;
          background: var(--spirit-amber, #ffb15e); color: #14100a;
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .rw-cs-begin:hover { transform: scale(1.04); box-shadow: 0 0 20px rgba(255,177,94,0.4); }
        .rw-cs-begin:active { transform: scale(0.97); }
      </style>
      <div class="rw-cs-panel">
        <div class="rw-cs-title">Choose Your Spirit</div>
        <div class="rw-cs-subtitle">Every animal moves, fights, and climbs like the real thing.</div>
        <div class="rw-cs-cards"></div>
        <div class="rw-cs-preview-row">
          <canvas class="rw-cs-preview-canvas"></canvas>
          <div class="rw-cs-fieldnotes"></div>
        </div>
        <div class="rw-cs-skin-row">
          <button class="rw-cs-skin-btn rw-cs-skin-prev" type="button" aria-label="previous skin">&lsaquo;</button>
          <span class="rw-cs-swatch"></span>
          <span class="rw-cs-skin-name"></span>
          <button class="rw-cs-skin-btn rw-cs-skin-next" type="button" aria-label="next skin">&rsaquo;</button>
        </div>
        <button class="rw-cs-begin" type="button">Enter the Jungle</button>
      </div>
    `;
    container.appendChild(this.root);

    const cardsEl = this.root.querySelector('.rw-cs-cards')!;
    // Real combination-testing find: every other interactive control on this screen (skin
    // prev/next, "Enter the Jungle") is a real <button> — natively focusable, natively
    // Enter/Space-activatable, no custom keyboard code needed. These species cards were a plain
    // <div> with only a click handler — invisible to Tab order and unusable by keyboard alone,
    // the one real inconsistency on an otherwise keyboard-complete screen. A <button> is the
    // correct fix, not tabindex/role/keydown bolted onto a div — same native semantics for free.
    this.cardEls = SPECIES_ORDER.map((species) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'rw-cs-card';
      const info = SPECIES_LABELS[species];
      card.innerHTML = `<div class="rw-cs-species-name">${info.name}</div><div class="rw-cs-blurb">${info.blurb}</div>`;
      card.addEventListener('click', () => this.selectSpecies(species));
      cardsEl.appendChild(card);
      return card;
    });

    this.swatchEl = this.root.querySelector('.rw-cs-swatch')!;
    this.skinNameEl = this.root.querySelector('.rw-cs-skin-name')!;
    this.prevBtn = this.root.querySelector('.rw-cs-skin-prev')!;
    this.nextBtn = this.root.querySelector('.rw-cs-skin-next')!;
    this.beginBtn = this.root.querySelector('.rw-cs-begin')!;
    this.fieldNotesEl = this.root.querySelector('.rw-cs-fieldnotes')!;

    this.prevBtn.addEventListener('click', () => this.cycleSkin(-1));
    this.nextBtn.addEventListener('click', () => this.cycleSkin(1));

    if (typeof WebGLRenderingContext !== 'undefined') {
      this.initPreview(this.root.querySelector('.rw-cs-preview-canvas') as HTMLCanvasElement);
    }

    this.render();
  }

  private initPreview(canvasEl: HTMLCanvasElement): void {
    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    // Every playable character puts its own meshes on layer 1 (see createFox.ts's own comment —
    // it's how the main game hides the player's body in first-person "foxEye" view). This camera
    // needs that layer enabled too, or every character renders as literally nothing here.
    this.previewCamera.layers.enable(1);
    this.previewRenderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
    this.previewRenderer.setSize(168, 168, true);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    this.previewScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xfff0dd, 1.1);
    key.position.set(2, 3, 2);
    this.previewScene.add(key);

    this.previewStart = performance.now();
    const loop = (now: number) => {
      this.previewRafId = requestAnimationFrame(loop);
      if (this.previewCharacter) {
        const t = (now - this.previewStart) / 1000;
        this.previewCharacter.group.rotation.y = t * 0.6; // slow real turntable, not a static portrait
        this.previewCharacter.update(t, 0, 0);
      }
      this.previewRenderer!.render(this.previewScene!, this.previewCamera!);
    };
    this.previewRafId = requestAnimationFrame(loop);
  }

  /** Swaps the live preview to `species`/`skinId`'s own real model, disposing the previous one —
   * called on every render() so cycling species/skins never leaks the replaced meshes. */
  private swapPreviewCharacter(species: SpeciesId, skinId: string): void {
    if (!this.previewScene || !this.previewCamera) return;
    if (this.previewCharacter) {
      this.previewScene.remove(this.previewCharacter.group);
      disposeGroup(this.previewCharacter.group);
    }
    const character = createPlayableCharacter(species, skinId);
    this.previewScene.add(character.group);
    this.previewCharacter = character;

    const box = new THREE.Box3().setFromObject(character.group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.3) * 0.5;
    const dist = (radius / Math.sin((this.previewCamera.fov * Math.PI) / 360)) * 1.6;
    this.previewCamera.position.set(center.x + dist * 0.55, center.y + radius * 0.7, center.z + dist * 0.75);
    this.previewCamera.lookAt(center);
  }

  private renderFieldNotes(species: SpeciesId): void {
    const note = WILD_FIELD_NOTES[species];
    if (note) {
      const ability = ABILITIES[note.abilityId];
      this.fieldNotesEl.innerHTML =
        `<div class="rw-cs-fn-stats">Wild ${SPECIES_LABELS[species].name.toLowerCase()} — HP ${note.hp} · bite ${note.biteDamage} dmg</div>` +
        `<div class="rw-cs-fn-skill">Defeat and eat one in the jungle to learn <strong>${ability.name}</strong> (key ${ability.key})</div>`;
    } else {
      const ability = ABILITIES['keen-ear'];
      this.fieldNotesEl.innerHTML =
        `<div class="rw-cs-fn-stats">Never hunted in the wild — the fox already knows its own trick.</div>` +
        `<div class="rw-cs-fn-skill">Starts with <strong>${ability.name}</strong> (key ${ability.key})</div>`;
    }
  }

  private selectSpecies(species: SpeciesId): void {
    this.speciesIndex = SPECIES_ORDER.indexOf(species);
    this.render();
    this.playVoicePreview(species);
  }

  private playVoicePreview(species: SpeciesId): void {
    if (!this.audio) return;
    this.audio.unlock(); // real click = a real user gesture, safe to unlock here
    switch (species) {
      case 'fox':
        this.audio.playFoxBark();
        break;
      case 'bear':
        this.audio.playBearGrowl();
        break;
      case 'viper':
        this.audio.playViperHiss();
        break;
      case 'boar':
        this.audio.playBoarSnort();
        break;
      case 'lion':
        this.audio.playLionRoar();
        break;
      case 'crocodile':
        this.audio.playCrocodileHiss();
        break;
    }
  }

  private cycleSkin(direction: 1 | -1): void {
    const species = SPECIES_ORDER[this.speciesIndex];
    const count = SPECIES_SKINS[species].length;
    this.skinIndexBySpecies[species] = (this.skinIndexBySpecies[species] + direction + count) % count;
    this.render();
  }

  private render(): void {
    this.cardEls.forEach((el, i) => el.classList.toggle('rw-cs-selected', i === this.speciesIndex));
    const species = SPECIES_ORDER[this.speciesIndex];
    const skin = SPECIES_SKINS[species][this.skinIndexBySpecies[species]];
    this.skinNameEl.textContent = skin.name;
    this.swatchEl.style.background = `radial-gradient(circle at 35% 30%, ${hex(skin.furColor)}, ${hex(skin.furDark)})`;
    this.swatchEl.style.setProperty('--swatch-glow', hex(skin.glowColor));
    this.renderFieldNotes(species);
    this.swapPreviewCharacter(species, skin.id);
  }

  /** Current selection, as it stands right now — read by the test harness and by confirm(). */
  current(): { species: SpeciesId; skinId: string } {
    const species = SPECIES_ORDER[this.speciesIndex];
    return { species, skinId: SPECIES_SKINS[species][this.skinIndexBySpecies[species]].id };
  }

  /** Resolves `whenConfirmed()`'s promise with the current selection and tears this screen's own
   * markup out of the document — called by the real "Enter the Jungle" click, and directly by
   * tests that don't want to simulate a fake click event. */
  private confirm(): void {
    const selection = this.current();
    this.teardownPreview();
    this.root.remove();
    this.resolveConfirm?.(selection);
  }

  private teardownPreview(): void {
    if (this.previewRafId !== null) cancelAnimationFrame(this.previewRafId);
    if (this.previewCharacter) disposeGroup(this.previewCharacter.group);
    this.previewRenderer?.dispose();
  }

  private resolveConfirm: ((selection: { species: SpeciesId; skinId: string }) => void) | null = null;

  whenConfirmed(): Promise<{ species: SpeciesId; skinId: string }> {
    return new Promise((resolve) => {
      this.resolveConfirm = resolve;
      this.beginBtn.addEventListener('click', () => this.confirm());
    });
  }
}

export function selectCharacter(container: HTMLElement): Promise<{ species: SpeciesId; skinId: string }> {
  return new CharacterSelect(container).whenConfirmed();
}
