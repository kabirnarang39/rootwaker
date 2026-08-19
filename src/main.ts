import { selectCharacter } from './game/CharacterSelect';
import { ResumeGate } from './game/ResumeGate';
import { SaveGame } from './game/SaveGame';

const app = document.querySelector<HTMLDivElement>('#app')!;
const saveGame = new SaveGame();

// Real bundle-size fix, not just a Vite warning silenced: Game.ts alone is ~130KB of source
// before even counting its own dependency tree (every species/entity file, HUD, weather,
// postprocessing) — the actual bulk of this project's single monolithic chunk. None of that is
// needed until the player has ALREADY finished character-select/resume-gate (a real user-gesture
// gate, not a race), so a dynamic import here means the FIRST paint every player ever sees loads
// only what CharacterSelect/ResumeGate actually need, deferring the rest until the moment it's
// truly required — same code-splitting idiom this project already uses for DuelSession/
// ChallengeGate (see Game.ts's own dynamic imports for the duel flow).
async function loadGame() {
  const { Game } = await import('./game/Game');
  return Game;
}

async function boot(): Promise<void> {
  const existingSave = await saveGame.load();

  if (existingSave) {
    const decision = await new ResumeGate(app, existingSave).whenDecided();
    if (decision.action === 'resume') {
      const Game = await loadGame();
      new Game(app, { species: existingSave.species, skinId: existingSave.skinId }, existingSave).start();
      return;
    }
    saveGame.clear();
  }

  const character = await selectCharacter(app);
  const Game = await loadGame();
  new Game(app, character).start();
}

boot();
