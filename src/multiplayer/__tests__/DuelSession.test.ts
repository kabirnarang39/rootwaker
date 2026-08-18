import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { DuelSession, type DuelOutcome } from '../DuelSession';
import type { P2PChallengeLink, PeerRole } from '../P2PChallengeLink';
import { CLAW_SWIPE } from '../../game/Combat';

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
    for (let i = 0; i < 30; i++) duel.update(1 / 60, { x: 1, z: 0, jump: false }, false);
    expect(h.host.controller.body.position.x).toBeGreaterThan(before);
  });

  it('as guest: update() sends real input over the link and does not run local physics (no desync risk)', () => {
    const { link, sent } = fakeLink('guest');
    const duel = new DuelSession(link, fox, bear);
    const h = duel as unknown as { guest: { controller: { body: { position: { x: number } } } } };
    const before = h.guest.controller.body.position.x;
    duel.update(1 / 60, { x: 1, z: 0, jump: false }, false);
    expect(sent).toContainEqual({ type: 'input', x: 1, z: 0, jump: false, attack: false });
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
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true);
    expect(h.guest.combatant.hp).toBeLessThan(hpBefore);
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
    duel.update(1 / 60, { x: 0, z: 0, jump: false }, true);

    expect(outcome).toEqual({ winner: 'host' });
    expect(duel.iAmWinner).toBe(true);
    expect(sent.some((m) => (m as { type: string; winner?: string }).type === 'state' && (m as { winner?: string }).winner === 'host')).toBe(true);
  });
});
