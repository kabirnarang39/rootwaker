export class HUD {
  private root: HTMLDivElement;
  private distanceEl: HTMLSpanElement;
  private motesEl: HTMLSpanElement;
  private overlay: HTMLDivElement;
  private overlayStats: HTMLDivElement;
  private overlayTitle: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.innerHTML = `
      <div class="rw-hud">
        <div class="rw-stat"><span class="rw-label">distance</span><span class="rw-distance">0</span>m</div>
        <div class="rw-stat"><span class="rw-label">light-motes</span><span class="rw-motes">0</span></div>
      </div>
      <div class="rw-overlay">
        <div class="rw-overlay-title">The forest claims you</div>
        <div class="rw-overlay-stats"></div>
        <div class="rw-overlay-hint">press space / tap to run again</div>
      </div>
    `;
    container.appendChild(this.root);

    const style = document.createElement('style');
    style.textContent = `
      .rw-hud {
        position: fixed; top: 18px; left: 18px; z-index: 10;
        font-family: ui-sans-serif, system-ui, sans-serif;
        color: #d9fff2; text-shadow: 0 0 8px rgba(95,247,255,0.6);
        display: flex; flex-direction: column; gap: 4px;
        pointer-events: none;
      }
      .rw-stat { font-size: 15px; letter-spacing: 0.03em; opacity: 0.92; }
      .rw-label { text-transform: uppercase; font-size: 10px; opacity: 0.6; margin-right: 8px; }
      .rw-distance, .rw-motes { font-variant-numeric: tabular-nums; font-weight: 600; margin-right: 4px; }
      .rw-overlay {
        position: fixed; inset: 0; z-index: 20;
        display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
        background: radial-gradient(ellipse at center, rgba(4,8,10,0.4) 0%, rgba(2,4,6,0.88) 70%);
        font-family: ui-sans-serif, system-ui, sans-serif; color: #eafff6; text-align: center;
      }
      .rw-overlay.rw-visible { display: flex; }
      .rw-overlay-title { font-size: 28px; letter-spacing: 0.04em; text-shadow: 0 0 16px rgba(95,247,255,0.55); }
      .rw-overlay-stats { font-size: 16px; opacity: 0.85; }
      .rw-overlay-hint { font-size: 12px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; }
    `;
    document.head.appendChild(style);

    this.distanceEl = this.root.querySelector('.rw-distance')!;
    this.motesEl = this.root.querySelector('.rw-motes')!;
    this.overlay = this.root.querySelector('.rw-overlay')!;
    this.overlayStats = this.root.querySelector('.rw-overlay-stats')!;
    this.overlayTitle = this.root.querySelector('.rw-overlay-title')!;
  }

  update(distance: number, motes: number) {
    this.distanceEl.textContent = Math.floor(distance).toString();
    this.motesEl.textContent = motes.toString();
  }

  showGameOver(distance: number, motes: number) {
    this.overlayTitle.textContent = 'The forest claims you';
    this.overlayStats.textContent = `${Math.floor(distance)}m run — ${motes} light-motes gathered`;
    this.overlay.classList.add('rw-visible');
  }

  hideGameOver() {
    this.overlay.classList.remove('rw-visible');
  }
}
