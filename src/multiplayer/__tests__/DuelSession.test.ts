import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { DuelSession, type DuelOutcome } from '../DuelSession';
import type { P2PChallengeLink, PeerRole } from '../P2PChallengeLink';
import { CLAW_SWIPE } from '../../game/Combat';
import { scaleMoveForSpecies } from '../../game/SpeciesCombatProfile';

const CLAW_SWIPE_DAMAGE = CLAW_SWIPE.damage;

interface FakeFighter {
  controller: { body: { position: THREE.Vector3 } };
  combatant: { hp: number };
}

function fakeLink(role: PeerRole): { link: P2PChallengeLink; sent: unknown[]; receive: (data: unknown) => void } {
  const sent: unknown[] = [];
  let handler: ((data: unknown) => void) | null = null;
  const link = {
    role,
    send: (data: unknown) => sent.push(data),
    onMessage: (h: (data: unknown) => void) => {
      handler = h;
    },
    onOpen: () => {},
    onClose: () => {},
    isOpen: true,
    close: vi.fn(),
  } as unknown as P2PChallengeLink;
  return { link, sent, receive: (data) => handler?.(data) };
}

const fox = { species: 'fox' as const, skinId: 'ember' };
const bear = { species: 'bear' as const, skinId: 'loam' };

describe('DuelSession', () => {
  it('host and guest fighters spawn on opposite sides of the arena', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { host: { controller: { body: { position: { z: number } } } }; guest: { controller: { body: { position: { z: number } } } } };
    expect(h.host.controller.body.position.z).toBeLessThan(0);
    expect(h.guest.controller.body.position.z).toBeGreaterThan(0);
  });

  it('as host: local input moves the host fighter through real PlayerController physics', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { host: { controller: { body: { position: { x: number } } } } };
    const before = h.host.controller.body.position.x;
    for (let i = 0; i < 30; i++) duel.update(1 / 60, { x: 1, z: 0, jump: false }, false, false);
    expect(h.host.controller.body.position.x).toBeGreaterThan(before);
  });

  it('as host: clamps an oversized remote input vector from the guest instead of trusting it directly (real anti-cheat — an unclamped x/z would let a malicious guest speed-hack/teleport, since PlayerController.update() multiplies input straight into velocity)', () => {
    const { link, receive } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { guest: { controller: { moveSpeed: number; body: { position: { x: number } } } } };
    const before = h.guest.controller.body.position.x;
    receive({ type: 'input', x: 999999, z: 0, jump: false, attack: false, dodge: false });
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, false, false);
    // Clamped to a real keyboard's max per-axis magnitude (1) — one frame at normal move speed,
    // not an instant teleport across the whole arena.
    const realMaxStep = h.guest.controller.moveSpeed * (1 / 60) * 1.5; // generous slack over one frame's real max displacement
    expect(h.guest.controller.body.position.x - before).toBeLessThan(realMaxStep);
  });

  it('as host: treats a non-numeric/NaN remote input axis as zero rather than propagating NaN into physics', () => {
    const { link, receive } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { guest: { controller: { body: { position: { x: number } } } } };
    const before = h.guest.controller.body.position.x;
    receive({ type: 'input', x: NaN, z: 'not a number', jump: false, attack: false, dodge: false });
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, false, false);
    expect(Number.isFinite(h.guest.controller.body.position.x)).toBe(true);
    expect(h.guest.controller.body.position.x).toBe(before);
  });

  it('as guest: update() sends real input over the link and does not run local physics (no desync risk)', () => {
    const { link, sent } = fakeLink('guest');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { guest: { controller: { body: { position: { x: number } } } } };
    const before = h.guest.controller.body.position.x;
    duel.update(1 / 60, { x: 1, z: 0, jump: false }, false, false);
    expect(sent).toContainEqual({ type: 'input', x: 1, z: 0, jump: false, attack: false, dodge: false });
    // Guest's own fighter position is untouched by its own input — only the host's authoritative
    // state broadcast (a 'state' message) is allowed to move it.
    expect(h.guest.controller.body.position.x).toBe(before);
  });

  it('as guest: receiving a real state broadcast from the host updates both fighters\' positions/hp', () => {
    const { link, receive } = fakeLink('guest');
    const duel = new DuelSession(link, fox, bear);
    receive({
      type: 'state',
      host: { x: 1, y: 0, z: -2, facingAngle: 0.5, hp: 80 },
      guest: { x: -1, y: 0, z: 2, facingAngle: 1.2, hp: 60 },
      winner: null,
    });
    expect(duel.hostHp).toBe(80);
    expect(duel.guestHp).toBe(60);
  });

  it('as host: a real melee hit at close range damages the defender and knocks it back', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { host: FakeFighter; guest: FakeFighter };
    // Place the guest right in front of the host (host faces +Z by default given its spawn).
    h.host.controller.body.position.set(0, 0, 0);
    h.guest.controller.body.position.set(0, 0, 0.6);
    const hpBefore = h.guest.combatant.hp;
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true, false);
    expect(h.guest.combatant.hp).toBeLessThan(hpBefore);
  });

  it('as host: a real landed hit sets the defender\'s real visible hurtUntil flinch window (not just an HP change) — same idiom as single-player\'s staggerUntil', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as {
      host: FakeFighter;
      guest: FakeFighter & { hurtUntil: number };
      time: number;
    };
    h.host.controller.body.position.set(0, 0, 0);
    h.guest.controller.body.position.set(0, 0, 0.6);
    expect(h.guest.hurtUntil).toBe(-Infinity);
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true, false);
    expect(h.guest.hurtUntil).toBeGreaterThan(h.time);
  });

  it('as host: defeating the guest declares the host the winner, fires onOutcome, and broadcasts the result', () => {
    const { link, sent } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { host: FakeFighter; guest: FakeFighter };
    h.host.controller.body.position.set(0, 0, 0);
    h.guest.controller.body.position.set(0, 0, 0.6);
    h.guest.combatant.hp = CLAW_SWIPE_DAMAGE; // exactly one real hit from lethal

    let outcome: DuelOutcome | null = null;
    duel.onOutcome((o) => {
      outcome = o;
    });
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true, false);

    expect(outcome).toEqual({ winner: 'host' });
    expect(duel.iAmWinner).toBe(true);
    expect(sent.some((m) => (m as { type: string; winner?: string }).type === 'state' && (m as { winner?: string }).winner === 'host')).toBe(true);
  });

  it('as host: a real 3-hit combo escalates damage per stage, same as single-player combat', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { host: FakeFighter; guest: FakeFighter };
    h.host.controller.body.position.set(0, 0, 0);
    h.guest.controller.body.position.set(0, 0, 0.6);

    const hpAfterHit = (): number => {
      const before = h.guest.combatant.hp;
      // 0.6s between presses: past every real stage's own recoverySeconds (the finisher's own
      // 0.55 is the longest gate in the chain), but comfortably inside COMBO_WINDOW_SECONDS(0.9)
      // so the chain doesn't reset between hits.
      duel.update(0.6, { x: 0, z: 0, jump: false }, true, false);
      return before - h.guest.combatant.hp;
    };
    const firstHitDamage = hpAfterHit();
    const secondHitDamage = hpAfterHit();
    const thirdHitDamage = hpAfterHit();
    expect(secondHitDamage).toBeGreaterThan(firstHitDamage);
    expect(thirdHitDamage).toBeGreaterThan(secondHitDamage);
  });

  it('as host: throwing a real attack sets the attacker\'s own attackPoseUntil, even on a whiff — a real swing should read on the attacker\'s own body, not just a hit on the defender', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { host: FakeFighter & { attackPoseUntil: number }; time: number };
    // Place the guest far away so the swing whiffs entirely.
    h.host.controller.body.position.set(0, 0, 0);
    expect(h.host.attackPoseUntil).toBe(-Infinity);
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true, false);
    expect(h.host.attackPoseUntil).toBeGreaterThan(h.time);
  });

  it('as host: a real per-species combo — a bear hits harder than a fox on the exact same move, same as single-player', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, bear, fox); // bear is host/attacker this time
    const h = duel as unknown as { host: FakeFighter; guest: FakeFighter };
    h.host.controller.body.position.set(0, 0, 0);
    h.guest.controller.body.position.set(0, 0, 0.6);
    const hpBefore = h.guest.combatant.hp;
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true, false);
    const bearDamage = hpBefore - h.guest.combatant.hp;
    expect(bearDamage).toBe(scaleMoveForSpecies(CLAW_SWIPE, 'bear').damage);
    expect(bearDamage).toBeGreaterThan(CLAW_SWIPE_DAMAGE);
  });

  it('as host: a real dodge grants i-frames — a hit that lands during the defender\'s invulnerability window deals zero damage', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { host: FakeFighter; guest: FakeFighter & { dodgeInvulnerableUntil: number } };
    h.host.controller.body.position.set(0, 0, 0);
    h.guest.controller.body.position.set(0, 0, 0.6);
    // Directly arm the guest's own i-frame window far enough into the future that the host's
    // upcoming attack (fired on the very next update()) is guaranteed to land inside it — the
    // same real effect a just-pressed dodge produces, isolated from dodge's own movement burst
    // so this test proves the i-frame gate specifically, not the roll itself.
    h.guest.dodgeInvulnerableUntil = Number.MAX_SAFE_INTEGER;
    const hpBefore = h.guest.combatant.hp;
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true, false);
    expect(h.guest.combatant.hp).toBe(hpBefore);
  });

  it('close() closes the underlying link (regression: the RTCPeerConnection used to stay open forever after a duel ended)', () => {
    const { link } = fakeLink('host');
    const duel = new DuelSession(link, fox, bear);
    duel.close();
    expect(link.close).toHaveBeenCalled();
  });
});
