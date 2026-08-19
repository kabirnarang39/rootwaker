import * as THREE from 'three';
import { PlayerController, type MoveInput } from '../game/PlayerController';
import { computeFacingAngle } from '../game/FoxFacing';
import { resolveMeleeHit, applyDamage, isDefeated, COMBO_MOVES, COMBO_WINDOW_SECONDS, COMBO_KNOCKBACK, type Combatant } from '../game/Combat';
import { scaleMoveForSpecies, scaleKnockbackForSpecies } from '../game/SpeciesCombatProfile';
import { createPlayableCharacter } from '../scene/createPlayableCharacter';
import type { PlayableCharacter, SpeciesId } from '../scene/PlayableCharacter';
import type { P2PChallengeLink, PeerRole } from './P2PChallengeLink';

const ARENA_RADIUS = 6;
export const DUEL_HP = 100;
const ATTACK_REACH = 1;
const ATTACK_RADIUS = 0.6;
const SPAWN_OFFSET = 3; // meters from center, on opposite sides

// Same real dodge feel as the single-player game (Game.ts's DODGE_* constants) — a decisive
// position burst with a real invulnerability WINDOW that covers only part of the roll's own
// duration, not the whole thing.
const DODGE_SPEED = 8;
const DODGE_SECONDS = 0.35;
const DODGE_IFRAME_SECONDS = 0.22;
const DODGE_COOLDOWN_SECONDS = 0.9;
const HURT_FLINCH_SECONDS = 0.22; // matches Game.ts's own HIT_STAGGER_SECONDS for single-player parity
const ATTACK_POSE_SECONDS = 0.22; // matches Game.ts's own ATTACK_POSE_SECONDS — see attackPose.ts

export interface DuelCombatantInfo {
  species: SpeciesId;
  skinId: string;
}

export interface DuelOutcome {
  winner: PeerRole;
}

interface DuelFighter {
  species: SpeciesId; // real per-species combo damage/recovery/knockback — see SpeciesCombatProfile.ts
  character: PlayableCharacter;
  controller: PlayerController;
  combatant: Combatant;
  facingAngle: number;
  lastAttackTime: number;
  comboStage: number;
  lastComboAttackTime: number;
  dodgeEndTime: number;
  dodgeDirection: THREE.Vector3;
  dodgeInvulnerableUntil: number;
  lastDodgeTime: number;
  // Real visible hit-flinch, same idiom as Game.ts's single-player staggerUntil — a landed hit
  // overlays a real recoil pose (see PlayableCharacter.update's hurt param) rather than only
  // changing the HP number.
  hurtUntil: number;
  // Real player-side attack-swing pose, same idiom as Game.ts's attackPoseUntil — see attackPose.ts.
  attackPoseUntil: number;
}

type NetMessage =
  | { type: 'hello'; species: SpeciesId; skinId: string }
  | { type: 'input'; x: number; z: number; jump: boolean; attack: boolean; dodge: boolean }
  | { type: 'state'; host: FighterSnapshot; guest: FighterSnapshot; winner: PeerRole | null };

interface FighterSnapshot {
  x: number;
  y: number;
  z: number;
  facingAngle: number;
  hp: number;
}

// Real anti-cheat: the host is authoritative and simulates the guest's movement directly from
// whatever x/z arrives over the network — PlayerController.update() multiplies input straight
// into velocity with no clamping of its own (safe in single-player, where input always comes
// pre-bounded from Input.ts's real {-1,0,1}-per-axis keyboard output; NOT safe for raw network
// data from a peer that could be running a modified client). Without this, a malicious guest
// sending e.g. {x: 999999} would get an instant speed-hack/teleport, since the honest host would
// unknowingly simulate it as real, authoritative movement. Clamps to the same [-1, 1] per-axis
// range a real keyboard could ever produce, and treats a non-numeric/NaN value as "no input" —
// the same substance as pass 11's leaderboard input validation, applied to duel netcode.
function clampAxis(value: unknown): number {
  const n = typeof value === 'number' ? value : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
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
  return {
    species: info.species,
    character,
    controller,
    combatant,
    facingAngle: Math.atan2(-spawnX, -spawnZ),
    lastAttackTime: -Infinity,
    comboStage: 0,
    lastComboAttackTime: -Infinity,
    dodgeEndTime: -Infinity,
    dodgeDirection: new THREE.Vector3(0, 0, 1),
    dodgeInvulnerableUntil: -Infinity,
    lastDodgeTime: -Infinity,
    hurtUntil: -Infinity,
    attackPoseUntil: -Infinity,
  };
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
 * by network input instead of local Input.ts on one side. Same real 3-hit combo chain and real
 * evasive dodge-with-i-frames as single-player combat (see Combat.ts's COMBO_MOVES) — a duel is
 * not a simpler, flatter fight than fighting the jungle's own animals. */
export class DuelSession {
  readonly group = new THREE.Group();
  private link: P2PChallengeLink;
  private role: PeerRole;
  private host: DuelFighter;
  private guest: DuelFighter;
  private remoteInput: MoveInput = { x: 0, z: 0, jump: false };
  private remoteAttackPressed = false;
  private remoteDodgePressed = false;
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
      this.remoteInput = { x: clampAxis(msg.x), z: clampAxis(msg.z), jump: msg.jump === true };
      if (msg.attack === true) this.remoteAttackPressed = true;
      if (msg.dodge === true) this.remoteDodgePressed = true;
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

  /** Called every frame with the LOCAL player's own move input and whether attack/dodge were
   * just pressed this frame (edge-triggered, not held). */
  update(delta: number, localInput: MoveInput, localAttackPressed: boolean, localDodgePressed: boolean): void {
    if (this.winner) return;
    this.time += delta;

    if (this.role === 'guest') {
      // Guest sends input, applies whatever state the host last broadcast, and does nothing else
      // — see the class doc comment for why running its own physics here would be a real bug
      // (silent desync from the host's authoritative outcome).
      this.link.send({ type: 'input', x: localInput.x, z: localInput.z, jump: localInput.jump, attack: localAttackPressed, dodge: localDodgePressed });
      this.updateVisuals(delta);
      return;
    }

    // Host: simulate both fighters for real.
    this.tryStartDodge(this.host, localInput, localDodgePressed);
    this.tryStartDodge(this.guest, this.remoteInput, this.remoteDodgePressed);
    this.remoteDodgePressed = false;

    this.advanceFighter(this.host, localInput, delta);
    this.advanceFighter(this.guest, this.remoteInput, delta);
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

  /** Real evasive roll: a decisive position burst plus a real invulnerability WINDOW covering
   * only part of the roll's own duration — mirrors Game.ts's tryDodge exactly, so single-player
   * and duel dodging feel identical. Dodges toward whatever direction is currently held (this
   * class's own input is already raw/un-camera-relative, so x/z map directly to world offset);
   * with no input held, rolls straight back along the fighter's own facing. */
  private tryStartDodge(fighter: DuelFighter, input: MoveInput, pressed: boolean): void {
    if (!pressed) return;
    if (this.time - fighter.lastDodgeTime < DODGE_COOLDOWN_SECONDS) return;
    fighter.lastDodgeTime = this.time;
    fighter.dodgeEndTime = this.time + DODGE_SECONDS;
    fighter.dodgeInvulnerableUntil = this.time + DODGE_IFRAME_SECONDS;
    const rawSpeed = Math.hypot(input.x, input.z);
    if (rawSpeed > 0.1) {
      fighter.dodgeDirection.set(input.x, 0, input.z).normalize();
    } else {
      fighter.dodgeDirection.set(Math.sin(fighter.facingAngle), 0, Math.cos(fighter.facingAngle)).negate();
    }
  }

  private advanceFighter(fighter: DuelFighter, input: MoveInput, delta: number): void {
    if (this.time < fighter.dodgeEndTime) {
      // Direct position/velocity override for the dodge window — same "bypass the normal
      // input->velocity mapping" idiom Game.ts's own dash/dodge branches use.
      fighter.controller.body.position.addScaledVector(fighter.dodgeDirection, DODGE_SPEED * delta);
      fighter.controller.body.position.y = this.groundHeightAt();
      fighter.controller.body.velocity.set(fighter.dodgeDirection.x * DODGE_SPEED, 0, fighter.dodgeDirection.z * DODGE_SPEED);
    } else {
      fighter.controller.update(input, delta, this.groundHeightAt);
    }
    fighter.facingAngle = computeFacingAngle(fighter.controller.body.velocity.x, fighter.controller.body.velocity.z, fighter.facingAngle, delta);
  }

  /** Real 3-hit combo, identical shape to Game.ts's own tryAttack: J,J,J within
   * COMBO_WINDOW_SECONDS advances through COMBO_MOVES with real escalating damage/knockback/
   * recovery; waiting too long resets to stage 0. A defender mid-dodge (its own i-frame window)
   * takes zero damage and zero knockback — the hit whiffs entirely, same as a real miss. */
  private resolveAttack(attacker: DuelFighter, defender: DuelFighter, pressed: boolean): void {
    if (!pressed) return;
    if (this.time - attacker.lastComboAttackTime > COMBO_WINDOW_SECONDS) attacker.comboStage = 0;
    // Real per-species combat identity, same as single-player's tryAttack — see
    // SpeciesCombatProfile.ts, so the two never silently drift apart.
    const move = scaleMoveForSpecies(COMBO_MOVES[attacker.comboStage], attacker.species);
    if (this.time - attacker.lastAttackTime < move.recoverySeconds) return;

    attacker.lastAttackTime = this.time;
    attacker.lastComboAttackTime = this.time;
    attacker.attackPoseUntil = this.time + ATTACK_POSE_SECONDS; // real swing pose, whether or not it lands
    const knockback = scaleKnockbackForSpecies(COMBO_KNOCKBACK[attacker.comboStage], attacker.species);
    attacker.comboStage = (attacker.comboStage + 1) % COMBO_MOVES.length;

    if (this.time < defender.dodgeInvulnerableUntil) return; // real dodge-through, no hit at all

    const forward = new THREE.Vector3(Math.sin(attacker.facingAngle), 0, Math.cos(attacker.facingAngle));
    const p = attacker.controller.body.position;
    const hitbox = {
      start: p.clone(),
      end: p.clone().addScaledVector(forward, ATTACK_REACH),
      radius: ATTACK_RADIUS,
    };
    if (resolveMeleeHit(hitbox, defender.combatant)) {
      applyDamage(defender.combatant, move.damage);
      defender.controller.body.position.addScaledVector(forward, knockback);
      defender.hurtUntil = this.time + HURT_FLINCH_SECONDS;
    }
  }

  private updateVisuals(delta: number): void {
    for (const fighter of [this.host, this.guest]) {
      fighter.character.group.position.copy(fighter.controller.body.position);
      fighter.character.group.rotation.y = fighter.facingAngle;
      // No real Block mechanic in a duel (see Game.ts's own comment on this), so blocking is
      // always false here — but a landed hit still gets the same real visible flinch overlay
      // single-player already has.
      fighter.character.update(
        this.time,
        delta,
        fighter.controller.moveSpeed,
        false,
        this.time < fighter.hurtUntil,
        false,
        this.time < fighter.attackPoseUntil,
      );
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

  // Real instance accessor for DUEL_HP — lets Game.ts read the duel max-HP constant off an
  // already-loaded DuelSession instance instead of needing its own static import of this module's
  // value export, since this module is lazy-loaded only once a duel actually starts (see
  // Game.ts's startDuel() dynamic import — keeps the multiplayer duel code out of the main bundle
  // for the common case where a session never touches multiplayer at all).
  get maxHp(): number {
    return DUEL_HP;
  }

  get iAmWinner(): boolean {
    return this.winner === this.role;
  }

  /** The local player's own fighter position — for a simple camera follow. The local player
   * always controls `host` if role is host, `guest` if role is guest. */
  get localFighterPosition(): THREE.Vector3 {
    return (this.role === 'host' ? this.host : this.guest).controller.body.position;
  }

  /** Real cleanup — closes the underlying RTCPeerConnection this duel was built on. Without this,
   * the connection (and DuelVoice's mic transceiver, if a call was active) stays fully open and
   * connected on both ends indefinitely after the duel ends, accumulating one live WebRTC
   * connection per duel played in a session. `link` is otherwise fully private to this class — no
   * consumer needs raw access to it, just the ability to end its lifecycle when the duel does. */
  close(): void {
    this.link.close();
  }
}
