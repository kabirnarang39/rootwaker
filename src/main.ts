import { Game } from './game/Game';
import { selectCharacter } from './game/CharacterSelect';

const app = document.querySelector<HTMLDivElement>('#app')!;
selectCharacter(app).then((character) => {
  new Game(app, character).start();
});
