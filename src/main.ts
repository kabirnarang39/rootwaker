import { Game } from './game/Game';
import { selectCharacter } from './game/CharacterSelect';
import { ResumeGate } from './game/ResumeGate';
import { SaveGame } from './game/SaveGame';

const app = document.querySelector<HTMLDivElement>('#app')!;
const saveGame = new SaveGame();

async function boot(): Promise<void> {
  const existingSave = await saveGame.load();

  if (existingSave) {
    const decision = await new ResumeGate(app, existingSave).whenDecided();
    if (decision.action === 'resume') {
      new Game(app, { species: existingSave.species, skinId: existingSave.skinId }, existingSave).start();
      return;
    }
    saveGame.clear();
  }

  const character = await selectCharacter(app);
  new Game(app, character).start();
}

boot();
