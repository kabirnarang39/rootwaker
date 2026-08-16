import { Game } from './game/Game';

const app = document.querySelector<HTMLDivElement>('#app')!;
new Game(app).start();
