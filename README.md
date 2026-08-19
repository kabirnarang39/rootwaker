# Rootwaker

**[Play it now → kabirnarang39.github.io/rootwaker](https://kabirnarang39.github.io/rootwaker/)**

A browser 3D action-adventure game. You're a fox-spirit courier in a jungle where an old myth is
waking. Hunt real animals to earn their powers, climb a real mountain, defeat the King, become the
new King of the Mountain in a real coronation — then duel other players in real peer-to-peer combat.

Built solo with Three.js and an AI pair-programming partner, entirely code-generated: no external
3D models, no external audio files (all sound is synthesized with the Web Audio API), no backend.

## Features

- **7 playable spirits** — fox, bear, viper, boar, lion, crocodile, owl (the only one with real
  flight locomotion), each with its own real anatomy, locomotion, and combat identity
- **Free-roam jungle chapter** — climbing, swimming, stealth hunting, escalating telegraph combat
- **A real animal cast to hunt** — bear, boar, owl, viper, lion, crocodile, shark, monkey, each
  with species-appropriate locomotion/attacks and a power you earn by defeating (and eating) them;
  squirrels and a finch flock as ambient, non-combat wildlife
- **A real living sea** — real swim-state gating, tide, and shark combat, not just decorative water
- **Real 3-hit combo combat** — dodge with true invincibility frames, block with chip damage,
  hit-stagger, finisher-triggered enemy stagger
- **A real mountain climb** — winding open-terrain ascent with stamina, rest ledges, wind hazards
- **A coronation ceremony** — defeat the King atop a real summit room with crown/throne regalia
  and a diverse costumed animal crowd
- **Real spatial audio** — every threat's telegraph/alert call pans and fades by real direction
  and distance from the player, not just a flat sound bank
- **Dynamic weather** — fog, light, tide, thunderstorms, and rain intensity coupled to one shared
  condition
- **Real touch controls** — a full on-screen joystick + action buttons on phones/tablets, not just
  a scaled-down desktop layout; installable as a standalone app (PWA) on mobile home screens
- **Encrypted local save/resume** — AES-GCM, no account, no server
- **A real distributed leaderboard** — gossip-synced peer-to-peer (via [trystero](https://github.com/dmotz/trystero)'s
  serverless WebRTC matchmaking over public relays), encrypted locally on your device, no backend
- **Real P2P duels** — challenge another player directly over WebRTC (no signaling server, no
  matchmaking service) with live voice and text chat during the fight

## Controls

| Key | Action |
|---|---|
| `W A S D` | Move |
| `Space` | Jump (owl: launch/ascend flight) |
| `Shift` | (owl, while flying) descend |
| `J` | Attack (3-hit combo) |
| `K` | Dodge |
| `H` | Block |
| `L` | Pounce (hunting) |
| Mouse drag | Look |
| `C` | Cycle camera view |
| `1–0` | Powers (10 slots) |
| `M` | Challenge another player to a duel |
| `O` | World leaderboard |
| `T` | Duel chat |
| `Y` | Duel voice mute |

On a phone or tablet, all of the above is available through a real on-screen joystick, action
buttons, and a secondary menu — no keyboard required. Tap the "?" in the top-right corner anytime
for the full control reference.

## Tech stack

- [Three.js](https://threejs.org/) for rendering — hand-rolled `Rig`/`Clip` procedural animation,
  no skeletons or GLTF assets
- TypeScript + [Vite](https://vitejs.dev/)
- [trystero](https://github.com/dmotz/trystero) for serverless WebRTC peer discovery
- [Vitest](https://vitest.dev/) for tests
- Hand-rolled Newtonian physics — no physics engine
- Web Audio API for every sound effect — no audio files

## Local development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite
npm run build    # typecheck + production build
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub
Pages automatically.

## License

MIT — see [LICENSE](LICENSE).
