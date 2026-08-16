import type { LeaderboardEntry } from '../leaderboard/LeaderboardClient';

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

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.innerHTML = `
      <div class="rw-hud">
        <div class="rw-stat"><span class="rw-label">distance</span><span class="rw-distance">0</span>m</div>
        <div class="rw-stat"><span class="rw-label">light-motes</span><span class="rw-motes">0</span></div>
        <div class="rw-stat rw-buff" style="display:none"><span class="rw-buff-label"></span> <span class="rw-buff-time"></span>s</div>
      </div>
      <div class="rw-overlay">
        <div class="rw-overlay-title">Rootwaker</div>
        <div class="rw-overlay-stats"></div>
        <ol class="rw-leaderboard" style="display:none"></ol>
        <form class="rw-submit-form" style="display:none">
          <input class="rw-submit-input" type="text" maxlength="20" placeholder="your name" autocomplete="off" />
          <button class="rw-submit-btn" type="submit">carve into the bark</button>
        </form>
        <div class="rw-overlay-hint">press space / tap to run</div>
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
      .rw-buff { color: #f5e3ff; text-shadow: 0 0 8px rgba(201,143,255,0.7); text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em; }
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
      .rw-leaderboard {
        list-style: none; margin: 0; padding: 0; width: min(320px, 80vw);
        display: flex; flex-direction: column; gap: 3px; pointer-events: auto;
        max-height: 220px; overflow-y: auto;
      }
      .rw-leaderboard li {
        display: flex; justify-content: space-between; gap: 10px;
        font-size: 13px; padding: 3px 10px; border-radius: 4px;
        background: rgba(95,247,255,0.04);
      }
      .rw-leaderboard li.rw-me { background: rgba(95,247,255,0.16); color: #eafff6; }
      .rw-leaderboard .rw-rank { opacity: 0.5; width: 1.6em; text-align: right; flex-shrink: 0; }
      .rw-leaderboard .rw-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rw-leaderboard .rw-dist { font-variant-numeric: tabular-nums; opacity: 0.85; }
      .rw-submit-form { display: flex; gap: 8px; pointer-events: auto; }
      .rw-submit-input {
        background: rgba(10,16,14,0.7); border: 1px solid rgba(95,247,255,0.35); border-radius: 4px;
        color: #eafff6; padding: 6px 10px; font-size: 13px; width: 160px;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .rw-submit-input:focus { outline: none; border-color: rgba(95,247,255,0.8); }
      .rw-submit-btn {
        background: rgba(95,247,255,0.14); border: 1px solid rgba(95,247,255,0.5); border-radius: 4px;
        color: #eafff6; padding: 6px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
        cursor: pointer; font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .rw-submit-btn:hover { background: rgba(95,247,255,0.26); }
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

    // typing a name shouldn't trigger the global space/enter restart listener
    this.submitForm.addEventListener('keydown', (e) => e.stopPropagation());
  }

  update(distance: number, motes: number) {
    this.distanceEl.textContent = Math.floor(distance).toString();
    this.motesEl.textContent = motes.toString();
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

  showGameOver(distance: number, motes: number) {
    this.overlayTitle.textContent = 'The forest claims you';
    this.overlayStats.textContent = `${Math.floor(distance)}m run — ${motes} light-motes gathered`;
    this.overlay.classList.add('rw-visible');
  }

  showStart() {
    this.overlayTitle.textContent = 'Rootwaker';
    this.overlayStats.textContent = 'a fox-spirit courier, a forest waking behind every step';
    this.overlay.classList.add('rw-visible');
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
      li.innerHTML = `<span class="rw-rank">${i + 1}</span><span class="rw-name">${escapeHtml(e.name)}</span><span class="rw-dist">${Math.floor(e.distance)}m</span>`;
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
