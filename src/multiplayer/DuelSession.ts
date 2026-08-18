import * as THREE from 'three';
import { PlayerController, type MoveInput } from '../game/PlayerController';
import { computeFacingAngle } from '../game/FoxFacing';
import { CLAW_SWIPE, resolveMeleeHit, applyDamage, isDefeated, type Combatant } from '../game/Combat';
import { createPlayableCharacter } from '../scene/createPlayableCharacter';
import type { PlayableCharacter, SpeciesId } from '../scene/PlayableCharacter';
import type { P2PChallengeLink, PeerRole } from './P2PChallengeLink';

const ARENA_RADIUS = 6;
export const DUEL_HP = 100;
const ATTACK_REACH = 1;
const ATTACK_RADIUS = 0.6;
const ATTACK_KNOCKBACK = 0.4;
const SPAWN_OFFSET = 3; // meters from center, on opposite sides

export interface DuelCombatantInfo {
  species: SpeciesId;
  skinId: string;
}

export interface DuelOutcome {
  winner: PeerRole;
}

interface DuelFighter {
  character: PlayableCharacter;
  controller: PlayerController;
  combatant: Combatant;
  facingAngle: number;
  lastAttackTime: number;
}

type NetMessage =
  | { type: 'hello'; species: SpeciesId; skinId: string }
  | { type: 'input'; x: number; z: number; jump: boolean; attack: boolean }
  | { type: 'state'; host: FighterSnapshot; guest: FighterSnapshot; winner: PeerRole | null };

interface FighterSnapshot {
  x: number;
  y: number;
  z: number;
  facingAngle: number;
  hp: number;
}

function snapshot(fighter: DuelFighter): FighterSnapshot {
  return {
    x: fighter.controller.body.position.x,
    y: fighter.controller.body.position.y,
    z: fighter.controller.body.position.z,
    facingAngle: fighter.facingAngle,
    hp: fighter.combatant.hp,
  };
}

function applySnapshot(fighter: DuelFighter, snap: FighterSnapshot): void {
  fighter.controller.body.position.set(snap.x, snap.y, snap.z);
  fighter.character.group.position.set(snap.x, snap.y, snap.z);
  fighter.character.group.rotation.y = snap.facingAngle;
  fighter.combatant.hp = snap.hp;
}

function makeFighter(info: DuelCombatantInfo, spawnX: number, spawnZ: number): DuelFighter {
  const character = createPlayableCharacter(info.species, info.skinId);
  const controller = new PlayerController(new THREE.Vector3(spawnX, 0, spawnZ));
  const combatant: Combatant = {
    hp: DUEL_HP,
    maxHp: DUEL_HP,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.4 },
  };
  character.group.position.copy(controller.body.position);
  return { character, controller, combatant, facingAngle: Math.atan2(-spawnX, -spawnZ), lastAttackTime: -Infinity };
}

function syncHitbox(fighter: DuelFighter): void {
  const p = fighter.controller.body.position;
  fighter.combatant.hitbox.start.set(p.x, p.y, p.z);
  fighter.combatant.hitbox.end.set(p.x, p.y + 0.5, p.z);
}

/** A real-time 1v1 duel between two browsers connected via P2PChallengeLink — no backend, host-
 * authoritative (the simplest correct netcode model for a 2-player game with no server: one side
 * runs the whole simulation, the other just sends its input and renders whatever the host says).
 * The host's word is final on every frame; the guest never runs its own physics/combat, so the two
 * views can never desync from each other — the honest tradeoff is that the host has a structural
 * fairness edge (zero input lag on its own actions, the guest's input always arrives a
 * network-round-trip late), acceptable for a cosmetic throne-claim duel, not appropriate for a
 * competitive-integrity game. Reuses the exact same PlayerController/Combat/createPlayableCharacter
 * machinery the single-player game already uses — a duel fighter IS a normal player, just driven
 * by network input instead of local Input.ts on one side. */
export class DuelSession {
  readonly group = new THREE.Group();
  private link: P2PChallengeLink;
  private role: PeerRole;
  private host: DuelFighter;
  private guest: DuelFighter;
  private remoteInput: MoveInput = { x: 0, z: 0, jump: false };
  private remoteAttackPressed = false;
  private outcomeHandlers: Array<(outcome: DuelOutcome) => void> = [];
  private winner: PeerRole | null = null;
  private time = 0;

  constructor(link: P2PChallengeLink, localInfo: DuelCombatantInfo, remoteInfo: DuelCombatantInfo) {
    this.link = link;
    this.role = link.role;

    const hostInfo = this.role === 'host' ? localInfo : remoteInfo;
    const guestInfo = this.role === 'host' ? remoteInfo : localInfo;
    this.host = makeFighter(hostInfo, 0, -SPAWN_OFFSET);
    this.guest = makeFighter(guestInfo, 0, SPAWN_OFFSET);

    this.group.name = 'duel-arena';
    this.group.add(this.buildArenaFloor());
    this.group.add(this.host.character.group, this.guest.character.group);

    this.link.onMessage((data) => this.handleMessage(data as NetMessage));
  }

  private buildArenaFloor(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 0.3, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2015, roughness: 1, flatShading: true });
    const floor = new THREE.Mesh(geo, mat);
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    return floor;
  }

  private handleMessage(msg: NetMessage): void {
    if (msg.type === 'input' && this.role === 'host') {
      this.remoteInput = { x: msg.x, z: msg.z, jump: msg.jump };
      if (msg.attack) this.remoteAttackPressed = true;
    } else if (msg.type === 'state' && this.role === 'guest') {
      applySnapshot(this.host, msg.host);
      applySnapshot(this.guest, msg.guest);
      if (msg.winner && !this.winner) this.declareWinner(msg.winner);
    }
  }

  private declareWinner(winner: PeerRole): void {
    if (this.winner) return;
    this.winner = winner;
    this.outcomeHandlers.forEach((h) => h({ winner }));
  }

  onOutcome(handler: (outcome: DuelOutcome) => void): void {
    this.outcomeHandlers.push(handler);
  }

  private groundHeightAt = () => 0; // a flat arena — every real level height query is just 0

  /** Called every frame with the LOCAL player's own move input and whether attack was just
   * pressed this frame (edge-triggered, not held). */
  update(delta: number, localInput: MoveInput, localAttackPressed: boolean): void {
    if (this.winner) return;
    this.time += delta;

    if (this.role === 'guest') {
      // Guest sends input, applies whatever state the host last broadcast, and does nothing else
      // — see the class doc comment for why running its own physics here would be a real bug
      // (silent desync from the host's authoritative outcome).
      this.link.send({ type: 'input', x: localInput.x, z: localInput.z, jump: localInput.jump, attack: localAttackPressed });
      this.updateVisuals(delta);
      return;
    }

    // Host: simulate both fighters for real.
    this.host.controller.update(localInput, delta, this.groundHeightAt);
    this.guest.controller.update(this.remoteInput, delta, this.groundHeightAt);
    this.host.facingAngle = computeFacingAngle(this.host.controller.body.velocity.x, this.host.controller.body.velocity.z, this.host.facingAngle, delta);
    this.guest.facingAngle = computeFacingAngle(this.guest.controller.body.velocity.x, this.guest.controller.body.velocity.z, this.guest.facingAngle, delta);
    syncHitbox(this.host);
    syncHitbox(this.guest);

    this.resolveAttack(this.host, this.guest, localAttackPressed);
    this.resolveAttack(this.guest, this.host, this.remoteAttackPressed);
    this.remoteAttackPressed = false;

    let winner: PeerRole | null = null;
    if (isDefeated(this.guest.combatant)) winner = 'host';
    else if (isDefeated(this.host.combatant)) winner = 'guest';

    this.link.send({ type: 'state', host: snapshot(this.host), guest: snapshot(this.guest), winner });
    if (winner) this.declareWinner(winner);

    this.updateVisuals(delta);
  }

  private resolveAttack(attacker: DuelFighter, defender: DuelFighter, pressed: boolean): void {
    if (!pressed) return;
    if (this.time - attacker.lastAttackTime < CLAW_SWIPE.recoverySeconds) return;
    attacker.lastAttackTime = this.time;
    const forward = new THREE.Vector3(Math.sin(attacker.facingAngle), 0, Math.cos(attacker.facingAngle));
    const p = attacker.controller.body.position;
    const hitbox = {
      start: p.clone(),
      end: p.clone().addScaledVector(forward, ATTACK_REACH),
      radius: ATTACK_RADIUS,
    };
    if (resolveMeleeHit(hitbox, defender.combatant)) {
      applyDamage(defender.combatant, CLAW_SWIPE.damage);
      defender.controller.body.position.addScaledVector(forward, ATTACK_KNOCKBACK);
    }
  }

  private updateVisuals(delta: number): void {
    for (const fighter of [this.host, this.guest]) {
      fighter.character.group.position.copy(fighter.controller.body.position);
      fighter.character.group.rotation.y = fighter.facingAngle;
      fighter.character.update(this.time, delta, fighter.controller.moveSpeed);
    }
  }

  get hostHp(): number {
    return this.host.combatant.hp;
  }

  get guestHp(): number {
    return this.guest.combatant.hp;
  }

  /** The local player's own HP, regardless of host/guest role — for the HUD's vitality bar. */
  get myHp(): number {
    return (this.role === 'host' ? this.host : this.guest).combatant.hp;
  }

  get iAmWinner(): boolean {
    return this.winner === this.role;
  }

  /** The local player's own fighter position — for a simple camera follow. The local player
   * always controls `host` if role is host, `guest` if role is guest. */
  get localFighterPosition(): THREE.Vector3 {
    return (this.role === 'host' ? this.host : this.guest).controller.body.position;
  }
}
