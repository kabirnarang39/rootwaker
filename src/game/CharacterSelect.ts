import { SPECIES_SKINS, SPECIES_LABELS } from '../scene/createPlayableCharacter';
import type { SpeciesId } from '../scene/PlayableCharacter';
import { AudioFX } from './Audio';

export const SPECIES_ORDER: SpeciesId[] = ['fox', 'bear', 'viper', 'boar', 'lion', 'crocodile'];

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
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
  private cardEls: HTMLDivElement[];
  private swatchEl: HTMLSpanElement;
  private skinNameEl: HTMLSpanElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private beginBtn: HTMLButtonElement;

  private speciesIndex = 0;
  private skinIndexBySpecies: Record<SpeciesId, number> = {
    fox: 0,
    bear: 0,
    viper: 0,
    boar: 0,
    lion: 0,
    crocodile: 0,
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
        .rw-cs-card {
          width: 190px; padding: 18px 16px; border-radius: 10px;
          border: 2px solid rgba(238,242,230,0.14);
          background: rgba(20,13,9,0.55);
          cursor: pointer; text-align: center;
          transition: border-color 180ms ease, transform 180ms ease, background 180ms ease;
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
    this.cardEls = SPECIES_ORDER.map((species) => {
      const card = document.createElement('div');
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

    this.prevBtn.addEventListener('click', () => this.cycleSkin(-1));
    this.nextBtn.addEventListener('click', () => this.cycleSkin(1));

    this.render();
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
    this.root.remove();
    this.resolveConfirm?.(selection);
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
