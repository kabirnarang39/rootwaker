import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createJungleLevel } from '../scene/createJungleLevel';
import { PlayerController } from './PlayerController';
import { CameraRig, type ViewMode } from '../scene/CameraRig';
import { createPlayableCharacter } from '../scene/createPlayableCharacter';
import { SKINS as FOX_SKINS } from '../scene/skins';
import type { PlayableCharacter, SpeciesId } from '../scene/PlayableCharacter';
import { createRootWraith, getAttackHitbox } from '../entities/rootWraith';
import { getBoarHitbox } from '../entities/tuskBoar';
import { getGroveBearHitbox } from '../entities/createGroveBear';
import { getElderBearKingHitbox } from '../entities/createElderBearKing';
import { getCanopyOwlHitbox } from '../entities/createCanopyOwl';
import { getVineViperHitbox } from '../entities/createVineViper';
import { getLionHitbox } from '../entities/createLion';
import type { FlockState } from '../entities/createDuskFinchFlock';
import { computeBossPhase, BOSS_PHASE_PARAMS } from '../entities/BossPhaseController';
import { VenomTracker, VENOM_DAMAGE_PER_TICK } from './Venom';
import { StoryBeatTracker, type StoryBeatId } from './StoryBeats';
import type { GroundSlamState } from './GroundSlam';
import type { GroveHare } from '../entities/groveHare';
import { resolveMeleeHit, applyDamage, isDefeated, COMBO_MOVES, COMBO_WINDOW_SECONDS, COMBO_KNOCKBACK, type Combatant } from './Combat';
import { Input, type PlayerAction } from './Input';
import { isInsideWaterBody } from './WaterBody';
import { computeApproachSpeed, checkPounceRange } from './Stalking';
import { HUD } from './HUD';
import { AudioFX } from './Audio';
import { AbilityKit, ABILITY_SLOTS, type AbilityId } from './AbilityKit';
import type { EnemyAI } from '../entities/EnemyAI';
import { WindGust, type GustState } from './WindGust';
import { resolvePlayerObstacleCollision } from './ObstacleCollision';
import { toCameraRelative } from './CameraRelativeMove';
import { computeFacingAngle } from './FoxFacing';
import { chaseTowardPlayer, horizontalDistance } from './EnemyChase';
import { applyClipToRig } from '../scene/rig/Clip';
import { eatClip } from '../scene/foxClips';
import { WeatherSystem } from './WeatherSystem';
import type { CoronationEntry } from '../leaderboard/CoronationLeaderboard';
import { DistributedCoronationLeaderboardClient } from '../multiplayer/DistributedLeaderboard';
import { getDeviceId } from '../multiplayer/DeviceIdentity';
import { SaveGame, type GameSaveState } from './SaveGame';
// The duel system (challenge gate, WebRTC session, chat, voice) is dynamically imported inside
// openChallengeGate()/startDuel() below rather than statically here — most sessions never press M,
// so this keeps that whole subsystem out of the main bundle for the common case. Only types are
// imported statically (erased at build, zero runtime cost).
import type { ChallengeGate } from '../multiplayer/ChallengeGate';
import type { DuelChat } from '../multiplayer/DuelChat';
import type { DuelVoice } from '../multiplayer/DuelVoice';
import type { DuelSession, DuelCombatantInfo } from '../multiplayer/DuelSession';
import type { P2PChallengeLink } from '../multiplayer/P2PChallengeLink';
import { createRainSystem, type RainSystem } from '../scene/createRainSystem';

// Mirrors PlayerController's own (unexported) pounce range so the hunt-prompt lights up
// exactly when a pounce would actually succeed. Keep these two in sync by hand.
const HUNT_PROMPT_RANGE = 2;
const VIEW_MODE_NAMES: Record<ViewMode, string> = {
  follow: 'Follow Cam',
  closeUp: 'Close Cam',
  hawkEye: 'Hawk Eye',
  foxEye: 'Fox Eyes',
};
const BOAR_HIT_DAMAGE = 12; // matches the root-wraith's melee hit — same claw-scale threat
const BEAR_HIT_DAMAGE = 12; // same claw-scale threat as the wraith/boar
const PLAYER_COLLISION_RADIUS = 0.35;
const PLAYER_COLLISION_HEIGHT = 0.9;
const LEDGE_REST_RADIUS = 1.5; // meters — how close to a mountain ledge counts as "resting" on it
const MAX_STAMINA = 100; // mirrors PlayerController's own (unexported) MAX_STAMINA
// ponytail: mountain ledges have no width/depth in ClimbSegment (only a center point), so this
// is a circular approximation of each ledge's rectangular footprint (real half-extents are up to
// 4x2m) rather than an exact box check. Upgrade to real bounds if a ledge ever proves too small
// for this radius or two ledges' radii start overlapping.
// Kept in sync by hand with setupLights()'s own hemi/moon constructor intensities — WeatherSystem
// scales relative to these base values every frame rather than the lights' own mutated .intensity
// (which would drift/compound if read back after a previous frame's scaling).
const BASE_HEMI_INTENSITY = 1.9;
const BASE_MOON_INTENSITY = 2.0;

const MOUNTAIN_LEDGE_RADIUS = 4.5;
const LEDGE_SNAP_TOLERANCE = 1; // meters of downward drift still counted as "on the ledge" this frame
const WALL_CLIMB_HEIGHT_TOLERANCE = 2.0; // meters — disambiguates stacked wall/segments sharing x/z footprint
const SUMMIT_GATE_RADIUS = 2; // meters — how close to the summit gate triggers the King encounter
const GROUND_SLAM_RANGE = 3; // meters — how close to the King the ground-slam hazard still hits

// Usable-powers tuning. Base attack stays CLAW_SWIPE-driven (Combat.ts); every power below is a
// distinct real effect, not a stat reskin of the base attack.
const DASH_SPEED = 14; // m/s during boar-charge's forward lunge
const DASH_SECONDS = 0.3; // duration of the lunge itself

// Real evasive roll (KeyK, already bound in Input.ts but never wired up until now): a short
// position burst plus a real invulnerability window that covers only PART of the roll's own
// duration — a real dodge has a committed recovery tail where you're still vulnerable, not
// invulnerable literally the whole time you're moving. A slower burst than DASH_SPEED (this is
// defensive positioning, not an attack) but still a real, decisive escape.
const DODGE_SPEED = 8;
const DODGE_SECONDS = 0.35;
const DODGE_IFRAME_SECONDS = 0.22;
const DODGE_COOLDOWN_SECONDS = 0.9;

// Real hit-stagger: taking a real hit briefly locks out movement input — the player visibly
// reacts to being struck instead of shrugging it off mid-stride. Short enough to never feel like
// a stunlock chain (every enemy's own recoverSeconds is comfortably longer than this), long
// enough to read as a real flinch.
const HIT_STAGGER_SECONDS = 0.22;

// Real block (hold KeyH): a real defensive stance, not a mash-J-forever combat — a blocked hit
// still lands real chip damage (a total-immunity block would trivialize combat entirely) but
// deep enough that trading blocked hits is clearly the losing move compared to actually dodging
// or fighting back. No hit-stagger on a blocked hit — you can hold guard through a real flurry.
const BLOCK_DAMAGE_MULTIPLIER = 0.25;
// Real duel camera distance/height — same rough framing as the normal follow view.
const DUEL_CAMERA_DISTANCE = 5;
const DUEL_CAMERA_HEIGHT = 2.2;
// A landed finisher (the 3rd real combo stage) staggers a stunnable enemy — the same real
// EnemyAI.stun() King's Roar already uses — so the combo's payoff is a real tactical opening, not
// just a bigger number. Single-player only: PvP duel opponents are real players, not an
// interruptible AI state machine, so this mechanic has no PvP equivalent by design.
const FINISHER_STAGGER_SECONDS = 0.6;
const DASH_DAMAGE = 16;
const DASH_RADIUS = 0.7;
const DASH_REACH = 3.2; // meters — the charge's forward hit capsule, well past the base attack's 1m reach
const DASH_KNOCKBACK = 1.0;
const HEAVY_SWIPE_DAMAGE = 14;
// Lion's Pounce reuses the exact same dashEndTime/dashDirection override PlayerController already
// drives for boar-charge — a real forward-burst attack, same underlying mechanism, just a longer
// airborne beat and the hardest-hitting of the base powers (apex predator).
const POUNCE_SECONDS = 0.35;
const POUNCE_DAMAGE = 18;
const POUNCE_RADIUS = 0.75;
const POUNCE_REACH = 3.0;
const POUNCE_KNOCKBACK = 1.3;
const HEAVY_SWIPE_RADIUS = 0.9;
const HEAVY_SWIPE_REACH = 1.3;
const HEAVY_SWIPE_KNOCKBACK = 0.6;
const ROAR_RADIUS = 5; // meters — King's Roar staggers every enemy within this range of the player
const ROAR_STUN_SECONDS = 2.5;
const ROAR_KNOCKBACK = 1.2;
const SENSE_SECONDS = 6; // Keen Ear's temporary extended hunt-sense window
const SENSE_RANGE_MULTIPLIER = 3;

// Real pursuit: an aggroed enemy (any non-'idle' AI state) closes real ground toward the player
// every frame instead of standing still and only "hitting" whoever happens to already be
// standing on top of it. The stop distance each enemy closes to is its own ai.strikeRange
// (EnemyAI.ts, set inside each entity's own update() from its combatant hitbox radius) — the
// same distance EnemyAI itself gates a completed telegraph on, so the chase and the attack gate
// never disagree about "in range." Speeds are per-species: the wraith slithers, the boar/bear
// surge, the King lumbers but hits harder.
// A real, legitimate design consequence, not a bug: the fox's own top speed
// (PlayerController.ts's MOVE_SPEED) is 4.5 m/s. A player who simply runs at full speed
// permanently outruns the wraith (3.2), bear (3.4), and King (2.6) — they visibly chase but can
// never close the gap unless the player slows, turns to fight, or gets cornered. The boar (4.5)
// exactly matches player speed and so never gains ground either. Only the owl (5.0, horizontal)
// and the viper (5.5) can actually run a fleeing player down. A fox genuinely outrunning a bear
// is correct, not a balance oversight.
const WRAITH_CHASE_SPEED = 3.2;
// A boar's real charge has two real gears, not one constant pursuit speed: it's an all-out sprint
// while actually committed to the charge (telegraph — this is also the phase EnemyAI keeps
// closing distance during), and a much slower repositioning trot everywhere else (recovering from
// a spent charge, or just having noticed the player) — real boars don't sprint continuously, they
// commit to short violent charges. This is what makes the boar READ as "charging," distinct from
// the bear's/wraith's steady, uniform pursuit.
const BOAR_CHARGE_SPEED = 6.2;
const BOAR_TROT_SPEED = 2.0;
const BEAR_CHASE_SPEED = 3.4;
const KING_CHASE_SPEED = 2.6;

// Owl: a real aerial predator, not a ground chaser with a Y offset bolted on. OWL_STRIKE_HOVER_Y
// is how far above the player it hovers once in strike position (a dive-bomb reads as an attack
// FROM ABOVE, not a beak poking in at chest height). Hand-verified (see the owl loop in animate()
// for the full arithmetic): with this hover height, the owl's AI gate must use HORIZONTAL
// distance, not chaseTowardPlayer/EnemyChase's usual 3D .distanceTo() convention — a 3D distance
// at this hover height would sit permanently outside computeStrikeRange(0.32) even fully
// converged, since sqrt(strikeRange^2 + hoverY^2) > strikeRange for any nonzero hover height.
const OWL_CHASE_SPEED = 5.0; // horizontal closing speed while diving
const OWL_DIVE_SPEED = 4.0; // vertical descent, m/s, toward strike-hover height
const OWL_CLIMB_SPEED = 2.0; // vertical climb, m/s, back to its own perch once idle
const OWL_STRIKE_HOVER_Y = 0.5;
const OWL_HIT_DAMAGE = 10;
const VIPER_CHASE_SPEED = 5.5;
const VIPER_HIT_DAMAGE = 9;
// Real two-gear hunting, same idiom as the boar's own BOAR_CHARGE_SPEED/BOAR_TROT_SPEED split — a
// real lion stalks slowly while closing distance, then commits to the fastest burst in the game
// once it telegraphs the actual pounce. The hardest-hitting regular enemy (short of the King) —
// a real apex predator.
const LION_STALK_SPEED = 1.8;
const LION_CHARGE_SPEED = 7.5;
const LION_HIT_DAMAGE = 14;

// Owl's Descent: a real forward-and-down leap (mirrors the boar-charge dash idiom — a direct
// position override for the leap window, falling through to the same obstacle/water checks).
const OWL_DIVE_LEAP_SECONDS = 0.45;
const OWL_DIVE_FORWARD_SPEED = 9; // m/s
const OWL_DIVE_PEAK_HEIGHT = 2.0; // meters, parabola apex above the takeoff ground height
const OWL_DIVE_AOE_RADIUS = 2.2;
const OWL_DIVE_AOE_DAMAGE = 18;
const OWL_DIVE_AOE_KNOCKBACK = 1.0;

// Viper Venom: envenoms every real enemy within range on activation; VenomTracker (Venom.ts)
// owns the tick timing/damage-per-tick, this is only the application radius.
const VENOM_APPLY_RADIUS = 3.5;

// Eat-to-gain-power ritual: long enough to read as 2-3 real chomps (eatClip loops on a 0.5s
// cycle — see foxClips.ts), short enough not to feel like a stall mid-fight with other enemies
// still closing in.
const EAT_RITUAL_SECONDS = 1.4;

// All mountain wall/segments share a fixed 6-unit segment height, so each one's base is
// wall.topY - 6. Gate proximity checks on this so stacked segments (same x/z, different
// height) don't false-match each other.
function isNearWallHeight(playerY: number, wallTopY: number, segmentHeight: number): boolean {
  const wallBaseY = wallTopY - segmentHeight;
  return Math.abs(playerY - wallBaseY) <= WALL_CLIMB_HEIGHT_TOLERANCE;
}

/** One live enemy flattened to exactly what the player's damage/kill paths need.
 *
 * `position` is the entity's real `group.position` BY REFERENCE — knockback writes through it,
 * so handing back a `.clone()` here would silently turn every knockback in the game into a no-op
 * while every test still passed. There is no `hitbox` field because `combatant.hitbox` already
 * IS the entity's own capsule (`resolveMeleeHit` reads it directly); a second alias for the same
 * object would be dead weight two readers could disagree about. */
interface EnemyEntry {
  combatant: Combatant;
  position: THREE.Vector3;
  ai: EnemyAI;
  /** King's Roar has never staggered the root-wraith, and this refactor deliberately does not
   * start: the wraith is the chapter's fixed pressure and stunning it is a real difficulty
   * change, not a structural one. Task 1 is behaviour-preserving, so the exclusion moves from
   * "the wraith isn't in roarStagger's list" to this explicit flag instead of quietly widening. */
  stunnable: boolean;
  /** Scene removal + level-array splice + ability unlock. Absent for the wraith (chapter-
   * persistent, never removed) and the King (the victory sequence in animate() owns his defeat). */
  onDefeat?: () => void;
  /** Set only for the real animals whose defeat grants a power (boar/bear/owl/viper) — this is
   * what gates the eat-ritual: a kill on a `grantsAbility` entry is queued through
   * queueEatRitual() (a real visible pause before onDefeat actually fires) instead of resolving
   * onDefeat immediately. The wraith (a root-spirit, not an animal, and its onDefeat only removes
   * it — no power) and the King (no onDefeat at all; a coronation, not a meal) are deliberately
   * excluded — the fox does not eat either of them. */
  grantsAbility?: AbilityId;
}

export class Game {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private contextLost = false;
  private composer: EffectComposer;
  private clock = new THREE.Clock();

  private level = createJungleLevel();
  // Static after level creation — computed once rather than re-spread every animate() frame.
  // Includes mountain wall/ledge/gate geometry so hawkEye's overhead sightline is checked
  // against overhanging rock the same way follow/closeUp already check against tree trunks.
  private cameraObstacles = [...this.level.foliageMeshes, ...this.level.climbObstacleMeshes];
  private playerController = new PlayerController(new THREE.Vector3(0, 0, 12));
  // Assigned in the constructor (needs the character-choice param), not here — every other
  // usage below (`this.fox.group`/`.rig`/`.update()`/`.revealCrown()`) is the shared
  // PlayableCharacter contract, so it reads identically no matter which species is live.
  private fox: PlayableCharacter;
  private cameraRig = new CameraRig();
  private weather = new WeatherSystem();
  private rain: RainSystem = createRainSystem();
  // Set in setupLights() once the real lights exist — kept so weather can scale their intensity
  // live every frame without re-deriving "what was this light's original brightness."
  private moonLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private baseFogDensity = 0.014; // matches the FogExp2 density set in the constructor below
  private wraith = createRootWraith();
  private playerCombatant: Combatant = {
    hp: 100,
    maxHp: 100,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.4 },
  };
  private checkpoint = new THREE.Vector3(0, 0, 12);

  private audio = new AudioFX();
  private abilityKit = new AbilityKit();
  private windGust = new WindGust();
  private prevGustState: GustState = 'calm';
  private mountainWindStarted = false;
  private seaAmbienceStarted = false;
  private summitGateCrossed = false;
  private kingDefeated = false;
  // Real local leaderboard stats — see CoronationLeaderboard.ts. animalsDefeated increments in
  // resolveDefeat(), the single place every real kill (boar/bear/owl/viper/lion/wraith) routes
  // through; the King itself isn't counted here (it's the boss, not "an animal defeated").
  // coronationSeconds is just `time` itself at the moment of victory — Game's own clock starts at
  // construction, so elapsed animate()-loop time already IS "how long this run took."
  private animalsDefeated = 0;
  private coronationLeaderboard = new DistributedCoronationLeaderboardClient();
  private playerSpecies: SpeciesId = 'fox';
  private playerSkinId: string = FOX_SKINS[0].id;
  private saveGame = new SaveGame();
  private lastAutosaveTime = -Infinity;
  private coronationSeconds: number | null = null;
  private container!: HTMLElement;
  // Real P2P throne-claim duel state — see multiplayer/DuelSession.ts and ChallengeGate.ts. Both
  // null outside a duel; `duel` is the live session once two players connect and start fighting.
  private duel: DuelSession | null = null;
  private challengeGate: ChallengeGate | null = null;
  private duelChat: DuelChat | null = null;
  private duelVoice: DuelVoice | null = null;
  private duelAttackPressed = false;
  private duelDodgePressed = false;
  // The root-wraith is unkillable and nothing notices (Task 6 Step 7a): nothing ever checked
  // isDefeated(wraith.combatant), so it absorbed hits and kept dealing damage forever past 0 HP.
  // A root-spirit grants no ability on kill, so its enemyEntries() onDefeat only removes it.
  private wraithDefeated = false;
  private prevGroundSlamState: GroundSlamState = 'idle';
  private groundSlamDamageApplied = false;
  private prevPlayerPosition = this.playerController.body.position.clone();

  // Per-instance "was this creature in <state> last frame" tracking for sound triggers, keyed by
  // each creature's own EnemyAI/WildlifeAI object — the same "fires once per state transition"
  // idiom prevGustState/prevGroundSlamState already use for the single-instance hazards, extended
  // to arrays of many creatures via WeakMap instead of one shared field.
  private prevOwlAiState = new WeakMap<object, string>();
  private prevViperAiState = new WeakMap<object, string>();
  private prevLionAiState = new WeakMap<object, string>();
  private prevBoarAiState = new WeakMap<object, string>();
  private prevBearAiState = new WeakMap<object, string>();
  private prevSquirrelState = new WeakMap<object, string>();
  private prevFinchFlockState: FlockState = 'perched';
  private prevWraithAiState = 'idle'; // single instance — no WeakMap needed, unlike the arrays above

  private venom = new VenomTracker();
  private storyBeats = new StoryBeatTracker();
  private owlDiveEndTime = -Infinity;
  private owlDiveDirection = new THREE.Vector3(0, 0, 1);
  private owlDiveAoeApplied = true; // starts "already applied" — no leap has happened yet

  // Eat-to-gain-power ritual: a kill on a real animal (grantsAbility set) doesn't resolve its
  // onDefeat instantly — it's queued here first, so the fox visibly consumes the fallen creature
  // BEFORE the power actually unlocks, replacing the old silent/instant unlock. One ritual runs
  // at a time; a second kill mid-ritual queues behind the first rather than being dropped or
  // resolving early — a fair, deterministic order, not a race.
  private eatQueue: Array<{ combatant: Combatant; onComplete?: () => void }> = [];
  private currentEat: { combatant: Combatant; onComplete?: () => void; endTime: number } | null = null;
  private eatChompIndex = -1; // which eatClip loop cycle the current ritual is on, for the per-chomp sound trigger
  // Every combatant currently mid-ritual — its own per-species update() is skipped entirely while
  // present here (frozen pose, no AI/chase/attack progression) so a "dead" body can't keep
  // fighting during its own eat-ritual pause. Checked by reference, so it stays correct even
  // though enemyEntries() rebuilds a fresh EnemyEntry wrapper around the same combatant every call.
  private beingEaten = new Set<Combatant>();

  private input: Input;
  private hud: HUD;

  private moveInput = { x: 0, z: 0, jump: false };
  // Raw (non-camera-relative) axis intent. Climbing reads z as "up/down the wall", not
  // "toward camera-forward" — the camera-relative transform would silently reverse or
  // zero out climb input depending on orbit yaw, so climb gates/updateClimb use this.
  private rawMoveInput = { x: 0, z: 0 };
  private jumpPressed = false;
  private foxFacingAngle = 0;
  private legendDismissed = false;
  private lastAttackTime = -Infinity;
  private dashEndTime = -Infinity;
  private dashDirection = new THREE.Vector3(0, 0, 1);
  private senseActiveUntil = -Infinity;

  // Real evasive roll (KeyK) — see DODGE_* constants above for the real timing reasoning.
  private dodgeEndTime = -Infinity;
  private dodgeDirection = new THREE.Vector3(0, 0, 1);
  private dodgeInvulnerableUntil = -Infinity;
  private lastDodgeTime = -Infinity;
  // Real 3-hit combo chain on the base attack — see COMBO_MOVES in Combat.ts.
  private comboStage = 0;
  private lastComboAttackTime = -Infinity;
  // Real hit-stagger — see HIT_STAGGER_SECONDS above.
  private staggerUntil = -Infinity;
  // Real block (hold KeyH) — computed once per frame in animate(), consumed later the same
  // frame by hurtPlayer() when an enemy attack actually resolves.
  private blocking = false;

  // Base terrain heightAt() has no notion of the mountain's elevated ledges, so a player
  // topping out a climb segment would otherwise free-fall straight back down to jungle-floor
  // height next frame. Layer each nearby ledge in as a candidate floor, same shape as
  // groundHeightAt but ledge-aware — the only caller is this.playerController.update() below.
  private groundHeightWithLedges = (x: number, z: number): number => {
    let best = this.level.groundHeightAt(x, z);
    const playerY = this.playerController.body.position.y;
    for (const segment of this.level.mountain.segments) {
      const ledge = segment.ledgePosition;
      const horizontalDist = Math.hypot(x - ledge.x, z - ledge.z);
      if (horizontalDist <= MOUNTAIN_LEDGE_RADIUS && playerY + LEDGE_SNAP_TOLERANCE >= ledge.y) {
        best = Math.max(best, ledge.y);
      }
    }
    // The throne-room floor (built past the summit gate) is its own flat slab, not one of the
    // mountain's climb-segment ledges, so it needs the same "candidate floor" treatment here —
    // otherwise a player who crosses the summit gate falls straight through the arena floor.
    // Box2.y here holds world Z, same convention as climbableWall.bounds elsewhere in this file.
    // Same playerY guard as the ledge loop above: the throne room's XZ footprint overlaps real
    // walkable jungle ground (both share the level's coordinate space at ground level), so
    // without this guard the floor candidate applies at EVERY altitude — a player walking
    // through that XZ patch at ground level would be snapped straight up to the summit,
    // skipping the whole climb.
    const { bounds } = this.level.throneRoom;
    if (
      x >= bounds.min.x &&
      x <= bounds.max.x &&
      z >= bounds.min.y &&
      z <= bounds.max.y &&
      playerY + LEDGE_SNAP_TOLERANCE >= this.level.mountain.summitGate.y
    ) {
      best = Math.max(best, this.level.mountain.summitGate.y);
    }
    return best;
  };

  constructor(
    container: HTMLElement,
    character: { species: SpeciesId; skinId: string } = { species: 'fox', skinId: FOX_SKINS[0].id },
    resume?: GameSaveState,
  ) {
    this.fox = createPlayableCharacter(character.species, character.skinId);
    this.playerSpecies = character.species;
    this.playerSkinId = character.skinId;
    this.container = container;
    this.scene.background = new THREE.Color(0x0a1420);
    this.scene.fog = new THREE.FogExp2(0x0a1420, 0.014);

    // touch-primary devices are almost always the fill-rate-constrained ones (phone GPUs) —
    // cap resolution and shadow detail there; desktop keeps full quality.
    const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchPrimary ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);
    this.setupContextLossRecovery(container);

    this.setupLights(isTouchPrimary);

    this.scene.add(this.level.group);
    this.scene.add(this.fox.group);
    this.scene.add(this.rain.group);
    this.wraith.group.position.set(4, 0, 4);
    this.scene.add(this.wraith.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraRig.camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45,
      0.4,
      0.82,
    );
    this.composer.addPass(bloomPass);
    this.composer.addPass(new OutputPass());

    this.input = new Input(this.renderer.domElement);
    this.input.onMove((x, z) => {
      const relative = toCameraRelative(x, z, this.cameraRig.orbitYaw);
      this.moveInput = { x: relative.x, z: relative.z, jump: this.jumpPressed };
      this.rawMoveInput = { x, z };
      this.jumpPressed = false;
      // pollMove() fires every frame even with no keys held (x=0, z=0) — only a nonzero
      // vector counts as the player's first real input.
      if (x !== 0 || z !== 0) this.dismissLegendOnce();
    });
    this.input.onLook((dy, dp) => {
      this.cameraRig.applyLookDelta(dy, dp);
      // pollLook() also fires every frame; only an actual drag delta counts.
      if (dy !== 0 || dp !== 0) this.dismissLegendOnce();
    });
    this.input.onAction((action: PlayerAction) => {
      this.dismissLegendOnce();
      if (action === 'multiplayer' && !this.duel && !this.challengeGate) {
        this.openChallengeGate();
        return;
      }
      if (action === 'leaderboard' && !this.duel) {
        this.coronationLeaderboard.getTop(10).then((entries) => this.hud.toggleLeaderboardView(entries));
        return;
      }
      if (action === 'chatFocus' && this.duel) {
        this.hud.focusDuelChatInput();
        return;
      }
      if (action === 'voiceMute' && this.duel) {
        this.hud.toggleDuelVoiceMute();
        return;
      }
      if (this.duel) {
        // A duel owns 'attack'/'dodge' entirely — same real combo/dodge depth as single-player
        // combat (see DuelSession.ts), but no abilities, jump, pounce, or view-cycle mid-duel.
        if (action === 'attack') this.duelAttackPressed = true;
        if (action === 'dodge') this.duelDodgePressed = true;
        return;
      }
      if (action === 'jump') this.jumpPressed = true;
      if (action === 'attack') this.tryAttack();
      if (action === 'dodge') this.tryDodge();
      if (action === 'pounce') this.tryPounce();
      if (action === 'cycleView') {
        this.cameraRig.cycleViewMode();
        this.hud.showViewMode(VIEW_MODE_NAMES[this.cameraRig.viewMode]);
      }
      if (action === 'ability1') this.tryActivateAbility(ABILITY_SLOTS[0]);
      if (action === 'ability2') this.tryActivateAbility(ABILITY_SLOTS[1]);
      if (action === 'ability3') this.tryActivateAbility(ABILITY_SLOTS[2]);
      if (action === 'ability4') this.tryActivateAbility(ABILITY_SLOTS[3]);
      if (action === 'ability5') this.tryActivateAbility(ABILITY_SLOTS[4]);
      if (action === 'ability6') this.tryActivateAbility(ABILITY_SLOTS[5]);
      if (action === 'ability7') this.tryActivateAbility(ABILITY_SLOTS[6]);
    });

    this.hud = new HUD(container);
    this.hud.initMinimap({
      bounds: {
        minX: this.level.chapterBounds.min.x,
        maxX: this.level.chapterBounds.max.x,
        minZ: this.level.chapterBounds.min.z,
        maxZ: this.level.chapterBounds.max.z,
      },
      mountainBase: {
        x: (this.level.climbableWall.bounds.min.x + this.level.climbableWall.bounds.max.x) / 2,
        z: (this.level.climbableWall.bounds.min.y + this.level.climbableWall.bounds.max.y) / 2,
      },
      mountainSummit: { x: this.level.mountain.summitGate.x, z: this.level.mountain.summitGate.z },
      water: {
        minX: this.level.water.bounds.min.x,
        maxX: this.level.water.bounds.max.x,
        minZ: this.level.water.bounds.min.z,
        maxZ: this.level.water.bounds.max.z,
      },
      groundHeightAt: this.level.groundHeightAt,
    });

    // AudioContext requires a user gesture to start — first keypress unlocks it and
    // kicks off the layered jungle ambience.
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true });

    window.addEventListener('resize', this.onResize);

    // Touch input has no real control scheme wired up yet (Input.ts is keyboard/mouse-drag
    // only), so a touch player can never fire onMove/onLook/onAction to dismiss the legend —
    // it would otherwise sit on screen permanently, listing controls a touch player can't use.
    this.renderer.domElement.addEventListener('touchstart', () => this.dismissLegendOnce(), { once: true, passive: true });

    if (resume) {
      // Real state restore, not just species/skin — checkpoint position/hp/unlocked
      // abilities/animals-defeated/king-status. Deliberately NOT restored: which specific
      // enemies were previously killed (they respawn fresh on resume) — a full world-state
      // snapshot is real extra scope beyond "resumable/checkpointable" and this project's own
      // "decompose rather than build everything at once" discipline; the player's own progress
      // (the part that actually matters for "did I lose my progress") is what's preserved.
      this.playerController.body.position.set(resume.checkpointX, resume.checkpointY, resume.checkpointZ);
      this.checkpoint.copy(this.playerController.body.position);
      this.playerCombatant.hp = resume.hp;
      this.playerCombatant.maxHp = resume.maxHp;
      for (const id of resume.unlockedAbilities) {
        if ((ABILITY_SLOTS as string[]).includes(id)) this.abilityKit.unlock(id as AbilityId);
      }
      this.animalsDefeated = resume.animalsDefeated;
      if (resume.kingDefeated) {
        // Restores the post-coronation world state without replaying the one-time
        // audio/story-beat/leaderboard-submit side effects from the original victory — those
        // already happened in the session that created this save.
        this.kingDefeated = true;
        this.level.throneRoom.openGate();
        this.fox.revealCrown();
        this.hud.setObjective('You are the new King of the Mountain.');
      }
    }

    // Best-effort autosave: real checkpoints (ability unlocks, King defeat) save immediately
    // elsewhere in this file, but a plain periodic save also catches ordinary progress (HP,
    // position) between those events. A closed tab without a clean unload still keeps whatever
    // the last periodic/event save wrote — real "resumable," not "only saves if you exit politely."
    window.addEventListener('beforeunload', () => {
      this.saveProgress();
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __rw: unknown }).__rw = {
        renderer: this.renderer,
        scene: this.scene,
        camera: this.cameraRig.camera,
        playerController: this.playerController,
        wraith: this.wraith,
        clock: this.clock,
        hud: this.hud,
        game: this,
      };
    }
  }

  /** Fades the controls-legend HUD panel the first time any real input handler fires. */
  private dismissLegendOnce() {
    if (this.legendDismissed) return;
    this.legendDismissed = true;
    this.hud.dismissLegend();
  }

  /** A real, previously-missing gap: a lost WebGL context (GPU driver reset, too many WebGL
   * contexts open across other tabs) used to leave the game silently frozen on a black canvas
   * with zero explanation. `webglcontextlost` MUST call preventDefault() to even leave restoration
   * possible, but three.js's own renderer state (textures/geometries/programs uploaded to the old
   * context) doesn't survive a real context swap without a full re-initialization this project
   * doesn't attempt — so the honest fix here is stopping the dead render loop and telling the
   * player plainly what happened and what to do, not pretending to silently recover. */
  private setupContextLossRecovery(container: HTMLElement): void {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;' +
      'flex-direction:column;gap:16px;background:rgba(5,8,6,0.95);color:#eef2e6;' +
      'font-family:ui-sans-serif,system-ui,sans-serif;text-align:center;padding:24px;';
    overlay.innerHTML = `
      <div style="font-size:20px;font-weight:600;">Graphics connection lost</div>
      <div style="font-size:14px;opacity:0.8;max-width:420px;">Your browser's WebGL context was lost — this can happen after a GPU driver reset or too many 3D tabs open at once. Reload to continue.</div>
      <button type="button" style="padding:10px 20px;border-radius:6px;cursor:pointer;border:none;background:#ffb15e;color:#14100a;font-size:14px;">Reload</button>
    `;
    overlay.querySelector('button')!.addEventListener('click', () => window.location.reload());
    container.appendChild(overlay);

    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); // required for the browser to even consider restoring the context
      this.contextLost = true;
      overlay.style.display = 'flex';
    });
  }

  private setupLights(isTouchPrimary: boolean) {
    const hemi = new THREE.HemisphereLight(0x4a7a8a, 0x1c3226, 1.9);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const moon = new THREE.DirectionalLight(0xafc8ff, 2.0);
    moon.position.set(-4, 8, 3);
    moon.castShadow = true;
    const shadowRes = isTouchPrimary ? 512 : 1024;
    moon.shadow.mapSize.set(shadowRes, shadowRes);
    moon.shadow.camera.left = -18;
    moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 18;
    moon.shadow.camera.bottom = -18;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 40;
    // The fox's own meshes live exclusively on render layer 1 (see createFox.ts) so the foxEye
    // camera can hide them without hiding the rest of the world. This does mean the fox casts
    // no self-shadow while in foxEye specifically — verified directly against three.cjs's
    // source that shadow-pass visibility gates on the MAIN render camera's layers (the one
    // actually passed to renderer.render()), not shadow.camera.layers (which the shadow pass
    // never reads at all — setting it here would be a no-op). No self-shadow in first-person
    // is the standard convention for this genre; not worth a shadow-only proxy mesh for it.
    this.scene.add(moon);
    this.moonLight = moon;

    const fill = new THREE.AmbientLight(0x203045, 0.85);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0x5ff7ff, 0.25, 8, 2);
    rim.position.set(0, 3, 6);
    this.scene.add(rim);
  }

  private onResize = () => {
    this.cameraRig.camera.aspect = window.innerWidth / window.innerHeight;
    this.cameraRig.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };

  start() {
    this.animate();
  }

  private animate = () => {
    // A lost WebGL context (GPU driver reset, too many contexts open elsewhere) makes every
    // further render call either throw or silently no-op into a black canvas — stop scheduling
    // frames entirely rather than spinning a loop that can't produce anything real. See
    // setupContextLossRecovery() for the real user-facing message this pairs with.
    if (this.contextLost) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    this.input.pollMove();
    this.input.pollLook();
    this.blocking = !this.duel && this.input.isHeld('KeyH'); // no block during a duel — see DuelSession's own combo/dodge parity note

    if (this.duel) {
      // Duel mode owns the frame entirely — none of the single-player world (weather, wildlife,
      // the King, abilities) runs while a real P2P duel is in progress; see DuelSession.ts for
      // the actual host-authoritative simulation this drives.
      const attackPressed = this.duelAttackPressed;
      this.duelAttackPressed = false;
      const dodgePressed = this.duelDodgePressed;
      this.duelDodgePressed = false;
      this.duel.update(delta, { x: this.rawMoveInput.x, z: this.rawMoveInput.z, jump: false }, attackPressed, dodgePressed);
      // A real orbiting camera, not a fixed angle — reuses the SAME orbitYaw/orbitPitch
      // CameraRig already accumulates from real mouse-drag every frame (Input.onLook/pollLook
      // run unconditionally regardless of duel state), with the exact same spherical-offset math
      // CameraRig.orbitedOffset uses internally, so drag-to-look feels identical to normal play.
      const p = this.duel.localFighterPosition;
      const yaw = this.cameraRig.orbitYaw;
      const pitch = this.cameraRig.orbitPitch;
      const pitchedDistance = DUEL_CAMERA_DISTANCE * Math.cos(pitch);
      const pitchedHeight = DUEL_CAMERA_HEIGHT + DUEL_CAMERA_DISTANCE * Math.sin(pitch);
      this.cameraRig.camera.position.set(
        p.x + pitchedDistance * Math.sin(yaw),
        p.y + pitchedHeight,
        p.z + pitchedDistance * Math.cos(yaw),
      );
      this.cameraRig.camera.lookAt(p.x, p.y + 0.6, p.z);
      this.hud.updateHealth(this.duel.myHp, this.duel.maxHp);
      this.composer.render();
      requestAnimationFrame(this.animate);
      return;
    }

    const AUTOSAVE_INTERVAL_SECONDS = 15;
    if (time - this.lastAutosaveTime >= AUTOSAVE_INTERVAL_SECONDS) {
      this.lastAutosaveTime = time;
      this.saveProgress();
    }

    const weatherSnap = this.weather.update(time);
    (this.scene.fog as THREE.FogExp2).density = this.baseFogDensity * weatherSnap.params.fogMultiplier;
    this.hemiLight.intensity = BASE_HEMI_INTENSITY * weatherSnap.params.lightMultiplier;
    this.moonLight.intensity = BASE_MOON_INTENSITY * weatherSnap.params.lightMultiplier;
    this.audio.setRainIntensity(weatherSnap.params.rainIntensity);
    this.rain.update(this.playerController.body.position, weatherSnap.params.rainIntensity, delta);

    this.level.update(time, weatherSnap.params.tideAmplitudeMultiplier);

    if (this.playerController.mode === 'grounded') {
      // Box2.y here holds world Z, per createJungleLevel's construction
      const nearWall =
        this.playerController.body.position.x <= this.level.climbableWall.bounds.max.x + 0.5 &&
        this.playerController.body.position.x >= this.level.climbableWall.bounds.min.x - 0.5 &&
        this.playerController.body.position.z >= this.level.climbableWall.bounds.min.y &&
        this.playerController.body.position.z <= this.level.climbableWall.bounds.max.y &&
        isNearWallHeight(this.playerController.body.position.y, this.level.climbableWall.topY, 6);
      if (nearWall && this.rawMoveInput.z > 0) {
        this.playerController.beginClimb(
          this.level.climbableWall.normal,
          this.level.climbableWall.topY,
          undefined,
          this.level.climbableWall.pathAt,
        );
      }

      if (this.playerController.mode === 'grounded' && this.rawMoveInput.z > 0) {
        for (const segment of this.level.mountain.segments) {
          const { wall } = segment;
          const nearSegmentWall =
            this.playerController.body.position.x <= wall.bounds.max.x + 0.5 &&
            this.playerController.body.position.x >= wall.bounds.min.x - 0.5 &&
            this.playerController.body.position.z >= wall.bounds.min.y &&
            this.playerController.body.position.z <= wall.bounds.max.y &&
            isNearWallHeight(this.playerController.body.position.y, wall.topY, 6);
          if (nearSegmentWall) {
            this.playerController.beginClimb(wall.normal, wall.topY, segment.ledgePosition, wall.pathAt);
            if (!this.mountainWindStarted) {
              this.mountainWindStarted = true;
              this.audio.startMountainWind(); // additive layer on top of jungle ambience — no zone-swap system exists in this project
            }
            break;
          }
        }
      }
    }

    if (this.playerController.mode === 'climbing') {
      this.playerController.updateClimb({ ...this.rawMoveInput, jump: false }, delta);
    } else if (this.playerController.mode === 'swimming') {
      this.playerController.updateSwim(this.moveInput, delta, this.level.water);
    } else {
      if (time < this.dashEndTime) {
        // Boar's Charge lunge — a direct position/velocity override for the dash window only,
        // same "bypass the normal input->velocity mapping" idiom windGust already uses on the
        // climbing branch above. Falls through to the shared obstacle-collision/water checks
        // below exactly like a normal grounded frame.
        this.playerController.body.position.addScaledVector(this.dashDirection, DASH_SPEED * delta);
        this.playerController.body.position.y = this.groundHeightWithLedges(
          this.playerController.body.position.x,
          this.playerController.body.position.z,
        );
        this.playerController.body.velocity.set(this.dashDirection.x * DASH_SPEED, 0, this.dashDirection.z * DASH_SPEED);
      } else if (time < this.dodgeEndTime) {
        // Real evasive roll — same "bypass the normal input->velocity mapping" idiom as the dash
        // branch above, deliberately kept as its own separate field/branch rather than reusing
        // dashEndTime: a defensive roll and an offensive charge-ability are semantically
        // different actions that happen to share a mechanism, not the same action.
        this.playerController.body.position.addScaledVector(this.dodgeDirection, DODGE_SPEED * delta);
        this.playerController.body.position.y = this.groundHeightWithLedges(
          this.playerController.body.position.x,
          this.playerController.body.position.z,
        );
        this.playerController.body.velocity.set(this.dodgeDirection.x * DODGE_SPEED, 0, this.dodgeDirection.z * DODGE_SPEED);
      } else if (time < this.owlDiveEndTime) {
        // Owl's Descent — the same "bypass the normal input->velocity mapping" idiom as the dash
        // above, but with a real parabolic arc: forward at OWL_DIVE_FORWARD_SPEED, vertical
        // offset peaking at OWL_DIVE_PEAK_HEIGHT mid-leap via 4*t*(1-t) (0 at t=0 and t=1, 1 at
        // t=0.5, scaled by the peak height — the standard normalized-parabola shape).
        const diveStart = this.owlDiveEndTime - OWL_DIVE_LEAP_SECONDS;
        const t = THREE.MathUtils.clamp((time - diveStart) / OWL_DIVE_LEAP_SECONDS, 0, 1);
        this.playerController.body.position.addScaledVector(this.owlDiveDirection, OWL_DIVE_FORWARD_SPEED * delta);
        const ground = this.groundHeightWithLedges(
          this.playerController.body.position.x,
          this.playerController.body.position.z,
        );
        this.playerController.body.position.y = ground + OWL_DIVE_PEAK_HEIGHT * 4 * t * (1 - t);
        this.playerController.body.velocity.set(
          this.owlDiveDirection.x * OWL_DIVE_FORWARD_SPEED,
          0,
          this.owlDiveDirection.z * OWL_DIVE_FORWARD_SPEED,
        );
      } else {
        // Real hit-stagger (a fresh hit briefly locks movement) AND real block (holding KeyH
        // roots you in a guard stance — a real defensive commitment, not a free-movement damage
        // reduction) both zero x/z the same way. jump is deliberately still allowed through both
        // (a real player can still leap away while staggered or guarding), and a dodge is a
        // direct position override that bypasses this branch entirely, so a skilled player can
        // always roll OUT of either state — never a true lockout.
        const movementLocked = time < this.staggerUntil || this.blocking;
        const effectiveMoveInput = movementLocked ? { x: 0, z: 0, jump: this.moveInput.jump } : this.moveInput;
        this.playerController.update(effectiveMoveInput, delta, this.groundHeightWithLedges);
      }
      // PLAYER_COLLISION_RADIUS (0.35m) must stay well under TreeObstacleGrid's cell size
      // (3m default) — nearby() ignores its radius arg and always does a fixed 3x3-cell
      // sweep, so a larger query radius could miss obstacles just outside that sweep.
      const nearbyObstacles = this.level.obstacleGrid.nearby(
        this.playerController.body.position.x,
        this.playerController.body.position.z,
        PLAYER_COLLISION_RADIUS,
      );
      resolvePlayerObstacleCollision(
        this.playerController.body.position,
        PLAYER_COLLISION_RADIUS,
        PLAYER_COLLISION_HEIGHT,
        nearbyObstacles,
      );
      if (isInsideWaterBody(this.playerController.body.position, this.level.water)) {
        this.playerController.beginSwim();
      }
    }

    // Owl's Descent AOE: applies exactly once, on the frame the leap window closes (landing),
    // using the player's fully-resolved position for the frame (after obstacle-collision/water
    // checks above) as the landing point.
    if (!this.owlDiveAoeApplied && time >= this.owlDiveEndTime) {
      this.owlDiveAoeApplied = true;
      const landingPos = this.playerController.body.position;
      for (const entry of this.enemyEntries()) {
        if (entry.position.distanceTo(landingPos) > OWL_DIVE_AOE_RADIUS) continue;
        applyDamage(entry.combatant, OWL_DIVE_AOE_DAMAGE);
        const dx = entry.position.x - landingPos.x;
        const dz = entry.position.z - landingPos.z;
        const dist = Math.hypot(dx, dz) || 1;
        entry.position.x += (dx / dist) * OWL_DIVE_AOE_KNOCKBACK;
        entry.position.z += (dz / dist) * OWL_DIVE_AOE_KNOCKBACK;
        if (isDefeated(entry.combatant)) this.resolveDefeat(entry);
      }
    }

    if (this.playerController.mode === 'grounded') {
      for (const segment of this.level.mountain.segments) {
        if (this.playerController.body.position.distanceTo(segment.ledgePosition) <= LEDGE_REST_RADIUS) {
          this.playerController.restStamina(delta);
          break;
        }
      }
    }

    if (!this.summitGateCrossed) {
      // Full 3D distance, not horizontal-only: the whole mountain is a vertical stack sharing
      // one x/z footprint with the summit gate (every segment/wall is built at the same
      // wallX/baseZ), so a horizontal-only check fires the instant the player reaches the
      // mountain's BASE, 24m below the real gate — teleporting the checkpoint into the air and
      // skipping the entire climb on the next death from anything.
      if (this.playerController.body.position.distanceTo(this.level.mountain.summitGate) <= SUMMIT_GATE_RADIUS) {
        this.summitGateCrossed = true;
        // fair-defeat-handling: a player who dies to the King respawns at the summit gate,
        // not back at the mountain's base — same silent-checkpoint idiom as isDefeated() below.
        this.checkpoint.copy(this.level.mountain.summitGate);
        this.hud.showBossBar('King of the Mountain');
        this.hud.setObjective('Defeat the King of the Mountain.');
        this.tryShowStoryBeat('king');
      }
    }

    this.windGust.update(delta);
    if (this.windGust.state === 'telegraph' && this.prevGustState !== 'telegraph') {
      this.audio.playWindTelegraph();
    } else if (this.windGust.state === 'gusting' && this.prevGustState !== 'gusting') {
      this.audio.playGustHit();
    }
    this.prevGustState = this.windGust.state;
    if (this.playerController.mode === 'climbing') {
      this.playerController.body.position.add(this.windGust.forceVector().multiplyScalar(delta));
    }

    this.fox.group.position.copy(this.playerController.body.position);
    this.fox.update(time, delta, this.playerController.moveSpeed, this.blocking);
    if (!this.seaAmbienceStarted) {
      const { min, max } = this.level.chapterBounds;
      const COAST_TRIGGER_MARGIN = 5; // starts once the player is within 5m of any of the island's 4 edges
      const p = this.playerController.body.position;
      if (p.x >= max.x - COAST_TRIGGER_MARGIN || p.x <= min.x + COAST_TRIGGER_MARGIN
        || p.z >= max.z - COAST_TRIGGER_MARGIN || p.z <= min.z + COAST_TRIGGER_MARGIN) {
        this.seaAmbienceStarted = true;
        this.audio.startSeaAmbience(); // additive layer, same idiom as mountainWindStarted below
      }
    }
    if (this.currentEat) {
      // Overlays on top of the normal idle/walk blend fox.update() just applied — only the
      // joints eatClip actually authors (spine/head/jaw/tail0) get overridden, so legs/ears etc.
      // stay under whatever fox.update() already gave them. applyPositionOffset/setLocalRotation
      // both write from the captured bind pose, not accumulate on the previous frame's value, so
      // calling this a second time per frame is safe (see Rig.captureBasePose's own doc comment).
      applyClipToRig(this.fox.rig, eatClip, time - (this.currentEat.endTime - EAT_RITUAL_SECONDS));
    }
    this.foxFacingAngle = computeFacingAngle(
      this.playerController.body.velocity.x,
      this.playerController.body.velocity.z,
      this.foxFacingAngle,
      delta,
    );
    this.fox.group.rotation.y = this.foxFacingAngle;

    // Sync player combat hitbox to actual position every frame (was permanently pinned at world origin)
    this.playerCombatant.hitbox.start.copy(this.playerController.body.position);
    this.playerCombatant.hitbox.end.copy(this.playerController.body.position).add(new THREE.Vector3(0, 0.9, 0));

    if (!this.wraithDefeated) {
      const distanceToPlayer = horizontalDistance(this.wraith.group.position, this.playerController.body.position);
      this.wraith.update(time, delta, distanceToPlayer);
      if (this.wraith.ai.state === 'telegraph' && this.prevWraithAiState !== 'telegraph') {
        this.audio.playWraithGroan();
        this.tryShowStoryBeat('wraith');
      }
      this.prevWraithAiState = this.wraith.ai.state;
      if (this.wraith.ai.state !== 'idle') {
        chaseTowardPlayer(this.wraith.group.position, this.playerController.body.position, WRAITH_CHASE_SPEED, delta, this.wraith.ai.strikeRange);
      }
      // Always re-snap, not just while chasing: a knockback (melee or an AOE power) moves x/z
      // but never y, so an idle enemy knocked back mid-stand used to keep a stale Y until it next
      // aggroed (Task 6 Step 7c). Applied uniformly to every ground melee enemy below too.
      this.wraith.group.position.y = this.level.groundHeightAt(this.wraith.group.position.x, this.wraith.group.position.z);
      if (this.wraith.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getAttackHitbox(this.wraith), this.playerCombatant);
        if (hit) this.hurtPlayer(12);
      }
    }

    for (const hare of this.level.hares) {
      const hareDistance = hare.position.distanceTo(this.playerController.body.position);
      const approachSpeed = computeApproachSpeed(
        this.playerController.body.position,
        this.prevPlayerPosition,
        hare.position,
        delta,
      );
      hare.update(time, delta, hareDistance, approachSpeed);
      if (hare.ai.state === 'fleeing') {
        const dx = hare.position.x - this.playerController.body.position.x;
        const dz = hare.position.z - this.playerController.body.position.z;
        const horizontalDist = Math.hypot(dx, dz);
        const awayFromDir =
          horizontalDist > 1e-6
            ? new THREE.Vector3(dx / horizontalDist, 0, dz / horizontalDist)
            : new THREE.Vector3(0, 0, 1);
        hare.fleeStep(delta, awayFromDir);
        hare.position.y = this.level.groundHeightAt(hare.position.x, hare.position.z);
      }
    }

    for (const boar of this.level.boars) {
      // Mid-eat-ritual: a real "dead body, frozen" beat — skip AI/chase/animation entirely so it
      // doesn't keep fighting while the fox is visibly consuming it.
      if (this.beingEaten.has(boar.combatant)) continue;
      const boarDistance = horizontalDistance(boar.group.position, this.playerController.body.position);
      const prevBoarAiState = this.prevBoarAiState.get(boar.ai);
      boar.update(time, delta, boarDistance);
      if (boar.ai.state === 'telegraph' && prevBoarAiState !== 'telegraph') {
        this.audio.playBoarSnort();
        this.tryShowStoryBeat('boar');
      }
      this.prevBoarAiState.set(boar.ai, boar.ai.state);
      if (boar.ai.state !== 'idle') {
        const boarSpeed = boar.ai.state === 'telegraph' ? BOAR_CHARGE_SPEED : BOAR_TROT_SPEED;
        chaseTowardPlayer(boar.group.position, this.playerController.body.position, boarSpeed, delta, boar.ai.strikeRange);
      }
      boar.group.position.y = this.level.groundHeightAt(boar.group.position.x, boar.group.position.z);
      if (boar.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getBoarHitbox(boar), this.playerCombatant);
        if (hit) this.hurtPlayer(BOAR_HIT_DAMAGE);
      }
    }

    for (const bear of this.level.bears) {
      if (this.beingEaten.has(bear.combatant)) continue;
      const bearDistance = horizontalDistance(bear.group.position, this.playerController.body.position);
      const prevBearAiState = this.prevBearAiState.get(bear.ai);
      bear.update(time, delta, bearDistance);
      if (bear.ai.state === 'telegraph' && prevBearAiState !== 'telegraph') {
        this.audio.playBearGrowl();
        this.tryShowStoryBeat('bear');
      }
      this.prevBearAiState.set(bear.ai, bear.ai.state);
      if (bear.ai.state !== 'idle') {
        chaseTowardPlayer(bear.group.position, this.playerController.body.position, BEAR_CHASE_SPEED, delta, bear.ai.strikeRange);
      }
      bear.group.position.y = this.level.groundHeightAt(bear.group.position.x, bear.group.position.z);
      if (bear.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getGroveBearHitbox(bear), this.playerCombatant);
        if (hit) this.hurtPlayer(BEAR_HIT_DAMAGE);
      }
    }

    for (const owl of this.level.owls) {
      if (this.beingEaten.has(owl.combatant)) continue;
      // horizontalDistance, not the 3D .distanceTo() this loop used before Task 6's own live
      // verification found the general reason every ground species needs it too (see that
      // function's doc comment) — for the owl specifically it's not just "usually smaller," it's
      // required: OWL_STRIKE_HOVER_Y is a deliberate, large, constant vertical offset, so a 3D
      // distance would sit permanently outside strikeRange by roughly that hover height even once
      // fully converged.
      const owlHorizontalDistance = horizontalDistance(owl.group.position, this.playerController.body.position);
      const prevOwlAiState = this.prevOwlAiState.get(owl.ai);
      owl.update(time, delta, owlHorizontalDistance);
      if (owl.ai.state === 'telegraph' && prevOwlAiState !== 'telegraph') {
        this.audio.playOwlScreech();
        this.tryShowStoryBeat('owl');
      }
      this.prevOwlAiState.set(owl.ai, owl.ai.state);

      // The owl's own Y is actively driven every frame in BOTH branches below (dive toward the
      // player's hover height, or climb back to its perch) — unlike a ground animal, it is never
      // just "re-snapped while chasing," so a knockback (which only ever touches x/z) can never
      // leave it stranded at a stale height the way Step 7c found for ground enemies.
      if (owl.ai.state !== 'idle') {
        chaseTowardPlayer(owl.group.position, this.playerController.body.position, OWL_CHASE_SPEED, delta, owl.ai.strikeRange);
        const targetY = this.playerController.body.position.y + OWL_STRIKE_HOVER_Y;
        const dy = targetY - owl.group.position.y;
        owl.group.position.y += Math.sign(dy) * Math.min(Math.abs(dy), OWL_DIVE_SPEED * delta);
      } else {
        const dy = owl.perchY - owl.group.position.y;
        owl.group.position.y += Math.sign(dy) * Math.min(Math.abs(dy), OWL_CLIMB_SPEED * delta);
      }
      if (owl.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getCanopyOwlHitbox(owl), this.playerCombatant);
        if (hit) this.hurtPlayer(OWL_HIT_DAMAGE);
      }
    }

    for (const viper of this.level.vipers) {
      if (this.beingEaten.has(viper.combatant)) continue;
      const viperDistance = horizontalDistance(viper.group.position, this.playerController.body.position);
      const prevViperAiState = this.prevViperAiState.get(viper.ai);
      viper.update(time, delta, viperDistance);
      if (viper.ai.state === 'telegraph' && prevViperAiState !== 'telegraph') {
        this.audio.playViperHiss();
        this.tryShowStoryBeat('viper');
      }
      this.prevViperAiState.set(viper.ai, viper.ai.state);

      if (viper.ai.state !== 'idle') {
        chaseTowardPlayer(viper.group.position, this.playerController.body.position, VIPER_CHASE_SPEED, delta, viper.ai.strikeRange);
      }
      viper.group.position.y = this.level.groundHeightAt(viper.group.position.x, viper.group.position.z);
      if (viper.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getVineViperHitbox(viper), this.playerCombatant);
        if (hit) this.hurtPlayer(VIPER_HIT_DAMAGE);
      }
    }

    for (const lion of this.level.lions) {
      if (this.beingEaten.has(lion.combatant)) continue;
      const lionDistance = horizontalDistance(lion.group.position, this.playerController.body.position);
      const prevLionAiState = this.prevLionAiState.get(lion.ai);
      lion.update(time, delta, lionDistance);
      if (lion.ai.state === 'telegraph' && prevLionAiState !== 'telegraph') {
        this.audio.playLionRoar();
        this.tryShowStoryBeat('lion');
      }
      this.prevLionAiState.set(lion.ai, lion.ai.state);

      if (lion.ai.state !== 'idle') {
        const lionSpeed = lion.ai.state === 'telegraph' ? LION_CHARGE_SPEED : LION_STALK_SPEED;
        chaseTowardPlayer(lion.group.position, this.playerController.body.position, lionSpeed, delta, lion.ai.strikeRange);
      }
      lion.group.position.y = this.level.groundHeightAt(lion.group.position.x, lion.group.position.z);
      if (lion.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getLionHitbox(lion), this.playerCombatant);
        if (hit) this.hurtPlayer(LION_HIT_DAMAGE);
      }
    }

    // Ambient wildlife below: no Combatant/EnemyAI, never damages or is damaged by the player.
    for (const squirrel of this.level.squirrels) {
      const squirrelDistance = squirrel.position.distanceTo(this.playerController.body.position);
      const squirrelApproachSpeed = computeApproachSpeed(
        this.playerController.body.position,
        this.prevPlayerPosition,
        squirrel.position,
        delta,
      );
      const prevSquirrelState = this.prevSquirrelState.get(squirrel.ai);
      squirrel.update(time, delta, squirrelDistance, squirrelApproachSpeed);
      if (squirrel.ai.state === 'alert' && prevSquirrelState !== 'alert') this.audio.playSquirrelChatter();
      this.prevSquirrelState.set(squirrel.ai, squirrel.ai.state);
      if (squirrel.ai.state === 'fleeing') {
        const dx = squirrel.position.x - this.playerController.body.position.x;
        const dz = squirrel.position.z - this.playerController.body.position.z;
        const horizontalDist = Math.hypot(dx, dz);
        const awayFromDir =
          horizontalDist > 1e-6
            ? new THREE.Vector3(dx / horizontalDist, 0, dz / horizontalDist)
            : new THREE.Vector3(0, 0, 1);
        squirrel.fleeStep(delta, awayFromDir);
        squirrel.position.y = this.level.groundHeightAt(squirrel.position.x, squirrel.position.z);
      }
    }

    {
      const flock = this.level.finchFlock;
      const flockDistance = this.level.finchFlockCenter.distanceTo(this.playerController.body.position);
      flock.update(time, delta, flockDistance);
      if (flock.state === 'flushed' && this.prevFinchFlockState !== 'flushed') this.audio.playBirdFlush();
      this.prevFinchFlockState = flock.state;
    }

    if (this.summitGateCrossed && !this.kingDefeated) {
      const king = this.level.throneRoom.king;
      const distanceToKing = horizontalDistance(king.group.position, this.playerController.body.position);
      king.update(time, delta, distanceToKing);
      if (king.ai.state !== 'idle') {
        chaseTowardPlayer(king.group.position, this.playerController.body.position, KING_CHASE_SPEED, delta, king.ai.strikeRange);
      }
      king.group.position.y = this.level.groundHeightAt(king.group.position.x, king.group.position.z);

      if (king.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getElderBearKingHitbox(king), this.playerCombatant);
        if (hit) {
          const phase = computeBossPhase(king.combatant.hp, king.combatant.maxHp);
          this.hurtPlayer(BOSS_PHASE_PARAMS[phase].damage);
        }
      }

      // Ground-slam hazard: sounds fire once per state transition (mirrors prevGustState's
      // idiom), and the active-window damage applies once per window (not every frame) via
      // groundSlamDamageApplied, reset only when a fresh 'active' window begins.
      if (king.groundSlam.state === 'telegraph' && this.prevGroundSlamState !== 'telegraph') {
        this.audio.playGroundSlamTelegraph();
      } else if (king.groundSlam.state === 'active' && this.prevGroundSlamState !== 'active') {
        this.audio.playGroundSlamImpact();
        this.groundSlamDamageApplied = false;
      }
      if (king.groundSlam.isDamaging() && !this.groundSlamDamageApplied) {
        const slamDx = this.playerController.body.position.x - king.group.position.x;
        const slamDz = this.playerController.body.position.z - king.group.position.z;
        if (Math.hypot(slamDx, slamDz) <= GROUND_SLAM_RANGE) {
          const phase = computeBossPhase(king.combatant.hp, king.combatant.maxHp);
          this.hurtPlayer(BOSS_PHASE_PARAMS[phase].damage);
          this.groundSlamDamageApplied = true;
        }
      }
      this.prevGroundSlamState = king.groundSlam.state;

      this.hud.updateBossHealth(king.combatant.hp, king.combatant.maxHp);

      if (isDefeated(king.combatant)) {
        this.kingDefeated = true;
        this.hud.hideBossBar();
        this.level.throneRoom.openGate(); // reveals both the village AND the real animal audience
        this.audio.playArcComplete();
        this.audio.playCoronationCheer();
        this.audio.startVillageAmbience();
        this.hud.showArcComplete();
        this.abilityKit.unlock('kings-roar');
        this.fox.revealCrown();
        this.hud.setObjective('You are the new King of the Mountain.');
        this.tryShowStoryBeat('coronation');

        this.coronationSeconds = time;
        const coronationEntry: CoronationEntry & { playerId: string } = {
          species: this.playerSpecies,
          coronationSeconds: time,
          animalsDefeated: this.animalsDefeated,
          playerId: getDeviceId(),
        };
        this.coronationLeaderboard.submit(coronationEntry).then(({ rank, top }) => {
          this.hud.showCoronationResult(rank, top, coronationEntry);
        });
        this.saveProgress(); // real checkpoint — becoming King is the single biggest moment to save
      }
    }

    // Viper Venom's damage-over-time ticks. onDefeat (set on every enemyEntries() entry that has
    // one) already calls venom.clear() as part of its own cleanup, so a killed target's remaining
    // ticks are dropped there, not duplicated here. The King and the wraith are both real,
    // reachable targets of `target` here (envenoming either is legitimate — see the King-victory
    // check above and this.wraithDefeated's own onDefeat, both of which independently notice a
    // combatant reaching 0 HP regardless of what reduced it there); the King has no onDefeat by
    // design (its victory sequence above owns its defeat), so a venom kill on the King just lets
    // that same isDefeated(king.combatant) check fire on a later frame, identical to a melee kill.
    this.venom.update(time, (target) => {
      const combatant = target as Combatant;
      applyDamage(combatant, VENOM_DAMAGE_PER_TICK);
      if (isDefeated(combatant)) {
        const entry = this.enemyEntries().find((e) => e.combatant === combatant);
        if (entry) this.resolveDefeat(entry);
      }
    });

    // Eat-ritual queue: one at a time. Starts the next queued kill once idle, resolves the
    // current one — the deferred onComplete (removal + array splice + ability unlock, exactly
    // what onDefeat used to do instantly) — once its real visible duration elapses, and plays a
    // real bite sound once per chomp cycle of eatClip (not once for the whole ritual), tracked by
    // the same "index changed since last frame" idiom prevGustState/prevGroundSlamState use.
    if (!this.currentEat && this.eatQueue.length > 0) {
      const next = this.eatQueue.shift()!;
      this.currentEat = { ...next, endTime: time + EAT_RITUAL_SECONDS };
      this.eatChompIndex = -1;
    }
    if (this.currentEat) {
      const elapsed = EAT_RITUAL_SECONDS - (this.currentEat.endTime - time);
      const chompIndex = Math.floor(elapsed / eatClip.duration);
      if (chompIndex !== this.eatChompIndex) {
        this.eatChompIndex = chompIndex;
        this.audio.playEatBite();
      }
    }
    if (this.currentEat && time >= this.currentEat.endTime) {
      const finished = this.currentEat;
      this.currentEat = null;
      this.beingEaten.delete(finished.combatant);
      finished.onComplete?.();
    }

    if (isDefeated(this.playerCombatant)) {
      // silent checkpoint respawn — no game-over screen, matches the chapter-restart design spec
      this.playerController.body.position.copy(this.checkpoint);
      this.playerController.body.velocity.set(0, 0, 0);
      this.playerController.mode = 'grounded';
      this.playerCombatant.hp = this.playerCombatant.maxHp;
    }

    if (this.findNearestHareInRange()) this.hud.showHuntPrompt(true);
    else this.hud.hideHuntPrompt();

    const unlockedAbility = this.abilityKit.unlockedThisFrame();
    if (unlockedAbility) {
      this.hud.showAbilityUnlocked(unlockedAbility);
      this.audio.playAbilityUnlock();
      this.saveProgress(); // real checkpoint — gaining a power is real, worth-saving progress
    }
    this.hud.updatePowers(
      ABILITY_SLOTS.map((id) => ({
        id,
        unlocked: this.abilityKit.has(id),
        ready: this.abilityKit.cooldownRemaining(id, time) <= 0,
      })),
    );

    const mode = this.playerController.mode;
    this.cameraRig.update(this.playerController.body.position, mode, delta, this.cameraObstacles, this.foxFacingAngle);

    this.hud.updateHealth(this.playerCombatant.hp, this.playerCombatant.maxHp);
    this.hud.updateStamina(this.playerController.stamina, MAX_STAMINA);
    this.hud.updateMinimap(this.playerController.body.position.x, this.playerController.body.position.z, this.foxFacingAngle);

    // must run after every this-frame use of the old position (stalking's approach-speed calc above)
    this.prevPlayerPosition.copy(this.playerController.body.position);

    this.composer.render();
    requestAnimationFrame(this.animate);
  };

  private findNearestHareInRange(): GroveHare | null {
    const senseActive = this.clock.elapsedTime < this.senseActiveUntil;
    const range = senseActive ? HUNT_PROMPT_RANGE * SENSE_RANGE_MULTIPLIER : HUNT_PROMPT_RANGE;
    let nearest: GroveHare | null = null;
    let nearestDistance = Infinity;
    for (const hare of this.level.hares) {
      const { inRange, distance } = checkPounceRange(this.playerController.body.position, hare.position, range);
      if (inRange && distance < nearestDistance) {
        nearestDistance = distance;
        nearest = hare;
      }
    }
    return nearest;
  }

  private tryPounce() {
    const nearestHare = this.findNearestHareInRange();
    if (!nearestHare) return;
    const senseActive = this.clock.elapsedTime < this.senseActiveUntil;
    const range = senseActive ? HUNT_PROMPT_RANGE * SENSE_RANGE_MULTIPLIER : HUNT_PROMPT_RANGE;
    const result = this.playerController.tryPounce(nearestHare.position, range);
    this.audio.playPounceAttempt(result.success);
    if (!result.success) return;
    const idx = this.level.hares.indexOf(nearestHare);
    if (idx !== -1) {
      this.level.group.remove(nearestHare.group);
      this.level.hares.splice(idx, 1);
    }
    this.abilityKit.unlock('keen-ear');
  }

  /** Applies damage to the player plus the real feedback that was previously missing entirely
   * (no sound, no screen cue — only the health-bar width eventually changed). */
  /** The single choke point every enemy attack (8 call sites: boar/bear/owl/viper/lion/wraith/
   * King calm/King enraged) already routes through — the real i-frame check lives here once,
   * not duplicated at each call site. A dodge's invulnerability window makes a real hit whiff
   * entirely: no damage, no flash, no hurt sound, the same as if the attack simply missed. */
  private hurtPlayer(amount: number): void {
    if (this.clock.elapsedTime < this.dodgeInvulnerableUntil) return;
    if (this.blocking) {
      // Real chip damage, not full immunity — a block absorbs most of a hit but still costs
      // something, and deliberately skips hit-stagger entirely: holding guard through a real
      // flurry has to actually work, not fold on the very first blocked swing.
      applyDamage(this.playerCombatant, amount * BLOCK_DAMAGE_MULTIPLIER);
      this.audio.playBlockImpact();
      return;
    }
    applyDamage(this.playerCombatant, amount);
    this.staggerUntil = this.clock.elapsedTime + HIT_STAGGER_SECONDS;
    this.audio.playPlayerHurt();
    this.hud.flashDamage();
  }

  /** Shows a story beat if `id` has never fired before this playthrough; a real no-op (no HUD
   * call at all) on every subsequent encounter with the same species — StoryBeatTracker.consume()
   * itself owns the once-only guarantee, this is just the show-it-if-real glue. */
  private tryShowStoryBeat(id: StoryBeatId): void {
    const beat = this.storyBeats.consume(id);
    if (beat) this.hud.showStoryBeat(beat.eyebrow, beat.text);
  }

  /** Unit forward vector for the fox's actual facing angle (see FoxFacing.ts's atan2(x,z)
   * convention: angle 0 == +Z). Every melee sweep uses this — never a hardcoded world axis. */
  private facingForward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.foxFacingAngle), 0, Math.cos(this.foxFacingAngle));
  }

  /** THE list of enemies the player can currently damage. Every consumer of "hurt/kill an enemy"
   * walks this one array instead of repeating a per-species block, which is the duplication that
   * has produced real bugs here before (a fix landing in one copy and not its siblings).
   *
   * A FRESH array every call, deliberately: an `onDefeat` splices `this.level.boars` while a
   * caller is mid-loop, and iterating the live array would make the splice shift every entry the
   * loop hasn't reached yet — the exact reason the old meleeSweep() had to count backwards.
   * Snapshot order is wraith, King (only while the fight is live), boars, bears — the order the
   * old per-species blocks ran in, so anything order-sensitive (the ability unlocked first when
   * one sweep kills two different species) is unchanged. */
  private enemyEntries(): EnemyEntry[] {
    const entries: EnemyEntry[] = [];

    // Task 6 Step 7a: the wraith used to have no onDefeat at all, so nothing ever noticed it
    // reaching 0 HP — it kept absorbing hits and dealing damage forever. It grants no ability (a
    // root-spirit, not an animal), so its onDefeat only removes it and stops it being iterated
    // (the animate() wraith block itself is separately gated on !this.wraithDefeated).
    if (!this.wraithDefeated) {
      entries.push({
        combatant: this.wraith.combatant,
        position: this.wraith.group.position,
        ai: this.wraith.ai,
        stunnable: false,
        onDefeat: () => {
          this.wraithDefeated = true;
          this.scene.remove(this.wraith.group);
          this.venom.clear(this.wraith.combatant);
        },
      });
    }

    if (this.summitGateCrossed && !this.kingDefeated) {
      const king = this.level.throneRoom.king;
      entries.push({ combatant: king.combatant, position: king.group.position, ai: king.ai, stunnable: true });
    }

    for (const boar of this.level.boars) {
      entries.push({
        combatant: boar.combatant,
        position: boar.group.position,
        ai: boar.ai,
        stunnable: true,
        grantsAbility: 'boar-charge',
        onDefeat: () => {
          this.level.group.remove(boar.group);
          // indexOf, not a captured index: the entry outlives the array layout it was built from,
          // and a second kill source (venom) may run onDefeat after something else already
          // spliced. -1 just means "already removed" — removal and unlock both stay idempotent.
          const idx = this.level.boars.indexOf(boar);
          if (idx !== -1) this.level.boars.splice(idx, 1);
          this.abilityKit.unlock('boar-charge');
          this.venom.clear(boar.combatant);
        },
      });
    }

    for (const bear of this.level.bears) {
      entries.push({
        combatant: bear.combatant,
        position: bear.group.position,
        ai: bear.ai,
        stunnable: true,
        grantsAbility: 'bear-swipe',
        onDefeat: () => {
          this.level.group.remove(bear.group);
          const idx = this.level.bears.indexOf(bear);
          if (idx !== -1) this.level.bears.splice(idx, 1);
          this.abilityKit.unlock('bear-swipe');
          this.venom.clear(bear.combatant);
        },
      });
    }

    for (const owl of this.level.owls) {
      entries.push({
        combatant: owl.combatant,
        position: owl.group.position,
        ai: owl.ai,
        stunnable: true,
        grantsAbility: 'owl-dive',
        onDefeat: () => {
          this.level.group.remove(owl.group);
          const idx = this.level.owls.indexOf(owl);
          if (idx !== -1) this.level.owls.splice(idx, 1);
          this.abilityKit.unlock('owl-dive');
          this.venom.clear(owl.combatant);
        },
      });
    }

    for (const viper of this.level.vipers) {
      entries.push({
        combatant: viper.combatant,
        position: viper.group.position,
        ai: viper.ai,
        stunnable: true,
        grantsAbility: 'viper-venom',
        onDefeat: () => {
          this.level.group.remove(viper.group);
          const idx = this.level.vipers.indexOf(viper);
          if (idx !== -1) this.level.vipers.splice(idx, 1);
          this.abilityKit.unlock('viper-venom');
          this.venom.clear(viper.combatant);
        },
      });
    }

    for (const lion of this.level.lions) {
      entries.push({
        combatant: lion.combatant,
        position: lion.group.position,
        ai: lion.ai,
        stunnable: true,
        grantsAbility: 'lion-pounce',
        onDefeat: () => {
          this.level.group.remove(lion.group);
          const idx = this.level.lions.indexOf(lion);
          if (idx !== -1) this.level.lions.splice(idx, 1);
          this.abilityKit.unlock('lion-pounce');
          this.venom.clear(lion.combatant);
        },
      });
    }

    // A combatant mid-eat-ritual is already dead — exclude it from every consumer at the one
    // source (melee, King's Roar, Owl's Descent AOE, and the venom-tick lookup all read this
    // list), rather than teaching each of them about beingEaten individually.
    return entries.filter((e) => !this.beingEaten.has(e.combatant));
  }

  /** THE single place every kill path (meleeSweep, Owl's Descent AOE, Viper Venom ticks) routes
   * an `isDefeated(entry.combatant)` result through. A real animal (grantsAbility set) is queued
   * into the eat-ritual instead of resolving onDefeat instantly — the fox visibly consumes it
   * first. The wraith and the King (both without grantsAbility) resolve immediately, exactly as
   * before this ritual existed. */
  /** Builds and encrypts a real snapshot of current progress — called on real checkpoints
   * (ability unlock, King defeat), a periodic autosave in animate(), and beforeunload as a
   * last-resort catch-all. Fire-and-forget: a save failing (storage full, private browsing)
   * should never interrupt gameplay, so the rejection is swallowed here rather than propagated. */
  private saveProgress(): void {
    const state: GameSaveState = {
      species: this.playerSpecies,
      skinId: this.playerSkinId,
      checkpointX: this.checkpoint.x,
      checkpointY: this.checkpoint.y,
      checkpointZ: this.checkpoint.z,
      hp: this.playerCombatant.hp,
      maxHp: this.playerCombatant.maxHp,
      unlockedAbilities: ABILITY_SLOTS.filter((id) => this.abilityKit.has(id)),
      animalsDefeated: this.animalsDefeated,
      kingDefeated: this.kingDefeated,
      coronationSeconds: this.coronationSeconds,
      savedAt: Date.now(),
    };
    this.saveGame.save(state).catch(() => {});
  }

  /** Opens the real WebRTC manual-code exchange screen (KeyM) — see ChallengeGate.ts's own doc
   * comment for why "current king" is inherently a local, per-player fact rather than a globally
   * synchronized one in a backend-free P2P design. */
  private async openChallengeGate(): Promise<void> {
    const { ChallengeGate } = await import('../multiplayer/ChallengeGate');
    const gate = new ChallengeGate(this.container, {
      species: this.playerSpecies,
      skinId: this.playerSkinId,
    });
    this.challengeGate = gate;
    try {
      const { link, remote } = await gate.whenConnected();
      await this.startDuel(link, remote);
    } catch {
      // canceled — no real state change, the player just returns to normal play
    } finally {
      this.challengeGate = null;
    }
  }

  private async startDuel(link: P2PChallengeLink, remote: DuelCombatantInfo): Promise<void> {
    const [{ DuelSession }, { DuelChat }, { DuelVoice }] = await Promise.all([
      import('../multiplayer/DuelSession'),
      import('../multiplayer/DuelChat'),
      import('../multiplayer/DuelVoice'),
    ]);
    this.level.group.visible = false;
    this.fox.group.visible = false;
    this.hud.hideBossBar();
    const local: DuelCombatantInfo = { species: this.playerSpecies, skinId: this.playerSkinId };
    this.duel = new DuelSession(link, local, remote);
    this.scene.add(this.duel.group);
    this.duel.onOutcome(() => this.finishDuel());
    this.duelChat = new DuelChat(link);
    this.hud.showDuelChat(this.duelChat);
    this.duelVoice = new DuelVoice(link);
    this.hud.showDuelVoice(this.duelVoice);
    void this.duelVoice.start(); // real mic prompt — silently no-ops if denied, see DuelVoice.start()
  }

  private finishDuel(): void {
    if (!this.duel) return;
    const won = this.duel.iAmWinner;
    this.scene.remove(this.duel.group);
    this.level.group.visible = true;
    this.fox.group.visible = true;
    this.duel = null;
    this.duelChat = null;
    this.hud.hideDuelChat();
    this.duelVoice?.stop();
    this.duelVoice = null;
    this.hud.hideDuelVoice();

    this.hud.showDuelOutcome(won);
    if (won) {
      this.kingDefeated = true;
      this.coronationSeconds = this.clock.elapsedTime;
      this.fox.revealCrown();
      this.hud.setObjective('You claimed the throne in single combat. You are the King of the Mountain.');
      this.audio.playCoronationCheer();
      const entry = {
        species: this.playerSpecies,
        coronationSeconds: this.coronationSeconds,
        animalsDefeated: this.animalsDefeated,
        playerId: getDeviceId(),
      };
      this.coronationLeaderboard.submit(entry).then(({ rank, top }) => {
        this.hud.showCoronationResult(rank, top, entry);
      });
      this.saveProgress();
    } else {
      this.hud.setObjective('You were defeated in single combat — grow stronger and challenge again.');
    }
  }

  private resolveDefeat(entry: EnemyEntry): void {
    if (entry.grantsAbility) {
      // Idempotency guard: a venom tick can still fire on a later frame against a combatant
      // that's already queued for its own eat-ritual (the array splice that would remove it from
      // enemyEntries() only happens inside the DEFERRED onComplete, not yet run) — without this
      // check that would push a second, duplicate ritual for the same kill.
      if (this.beingEaten.has(entry.combatant)) return;
      // A real, distinct killing-blow beat — fires exactly once per real kill regardless of
      // source (melee, venom tick, AOE), since every kill funnels through this one method.
      this.audio.playKnockout();
      this.hud.flashKO();
      // grantsAbility is exactly the field that distinguishes a real huntable animal from the
      // wraith (a root-spirit, no power, no count) — the leaderboard's animalsDefeated stat
      // should only count real animals, matching that same established distinction.
      this.animalsDefeated++;
      this.beingEaten.add(entry.combatant);
      this.eatQueue.push({ combatant: entry.combatant, onComplete: entry.onDefeat });
    } else {
      this.audio.playKnockout();
      this.hud.flashKO();
      entry.onDefeat?.();
    }
  }

  /** Shared hit-resolution for every player melee move (base attack, Boar's Charge, Bear
   * Swipe): a forward capsule of `radius` reaching `reach` meters along the fox's actual
   * facing, dealing `damage` and shoving anything hit back by `knockback` meters. Knockback
   * lands on every hit including the killing one, and one sound plays for the whole sweep no
   * matter how many enemies it caught. */
  private meleeSweep(damage: number, radius: number, reach: number, knockback: number, staggerEnemies = false): void {
    const forward = this.facingForward();
    const hitbox = {
      start: this.playerController.body.position.clone(),
      end: this.playerController.body.position.clone().addScaledVector(forward, reach),
      radius,
    };
    let hitAnything = false;

    for (const entry of this.enemyEntries()) {
      if (!resolveMeleeHit(hitbox, entry.combatant)) continue;
      applyDamage(entry.combatant, damage);
      entry.position.addScaledVector(forward, knockback);
      hitAnything = true;
      // A landed combo finisher is a real tactical opening, not just a bigger number — reuses
      // the exact same EnemyAI.stun() King's Roar already drives.
      if (staggerEnemies && entry.stunnable) entry.ai.stun(FINISHER_STAGGER_SECONDS);
      if (isDefeated(entry.combatant)) this.resolveDefeat(entry);
    }

    if (hitAnything) this.audio.playHit();
  }

  /** King's Roar: staggers (EnemyAI.stun) and shoves back every enemy within ROAR_RADIUS of the
   * player — an area power, not a melee sweep, so it doesn't go through meleeSweep(). Skips
   * anything not `stunnable` (today: the wraith only — see EnemyEntry.stunnable). */
  private roarStagger(): void {
    const playerPos = this.playerController.body.position;
    for (const entry of this.enemyEntries()) {
      if (!entry.stunnable) continue;
      if (entry.position.distanceTo(playerPos) > ROAR_RADIUS) continue;
      entry.ai.stun(ROAR_STUN_SECONDS);
      const dx = entry.position.x - playerPos.x;
      const dz = entry.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz) || 1;
      entry.position.x += (dx / dist) * ROAR_KNOCKBACK;
      entry.position.z += (dz / dist) * ROAR_KNOCKBACK;
    }
  }

  /** Fires on a Digit1-4 press. Each unlocked power is a real activatable move with its own
   * cooldown (AbilityKit.activate) — not the silent unlock-only flag this used to be. */
  private tryActivateAbility(id: AbilityId): void {
    const time = this.clock.elapsedTime;
    if (!this.abilityKit.activate(id, time)) return;

    switch (id) {
      case 'keen-ear':
        this.senseActiveUntil = time + SENSE_SECONDS;
        this.audio.playSensePulse();
        break;
      case 'boar-charge':
        this.dashEndTime = time + DASH_SECONDS;
        this.dashDirection.copy(this.facingForward());
        this.audio.playChargeDash();
        this.meleeSweep(DASH_DAMAGE, DASH_RADIUS, DASH_REACH, DASH_KNOCKBACK);
        break;
      case 'bear-swipe':
        this.audio.playBearSwipeActivate();
        this.meleeSweep(HEAVY_SWIPE_DAMAGE, HEAVY_SWIPE_RADIUS, HEAVY_SWIPE_REACH, HEAVY_SWIPE_KNOCKBACK);
        break;
      case 'kings-roar':
        this.roarStagger();
        this.audio.playRoar();
        break;
      case 'owl-dive':
        this.owlDiveEndTime = time + OWL_DIVE_LEAP_SECONDS;
        this.owlDiveDirection.copy(this.facingForward());
        this.owlDiveAoeApplied = false;
        this.audio.playOwlDive();
        break;
      case 'viper-venom':
        for (const entry of this.enemyEntries()) {
          if (entry.position.distanceTo(this.playerController.body.position) <= VENOM_APPLY_RADIUS) {
            this.venom.apply(entry.combatant, time);
          }
        }
        this.audio.playVenomBurst();
        break;
      case 'lion-pounce':
        this.dashEndTime = time + POUNCE_SECONDS;
        this.dashDirection.copy(this.facingForward());
        this.audio.playLionPounceActivate();
        this.meleeSweep(POUNCE_DAMAGE, POUNCE_RADIUS, POUNCE_REACH, POUNCE_KNOCKBACK);
        break;
    }
  }

  /** Real 3-hit combo: J,J,J within COMBO_WINDOW_SECONDS of each other advances through
   * COMBO_MOVES (light -> light -> heavy finisher), each stage with real escalating damage,
   * knockback, AND recovery cost — not a free damage upgrade, a real risk/reward chain. Waiting
   * too long between presses (or simply not attacking again in time) resets back to stage 0, so
   * this stays a real rhythm-based chain rather than a state that lingers forever. */
  private tryAttack() {
    const time = this.clock.elapsedTime;
    if (time - this.lastComboAttackTime > COMBO_WINDOW_SECONDS) this.comboStage = 0;

    const move = COMBO_MOVES[this.comboStage];
    if (time - this.lastAttackTime < move.recoverySeconds) return;

    this.lastAttackTime = time;
    this.lastComboAttackTime = time;
    const isFinisher = this.comboStage === COMBO_MOVES.length - 1;
    this.meleeSweep(move.damage, 0.6, 1, COMBO_KNOCKBACK[this.comboStage], isFinisher);
    if (isFinisher) this.audio.playBearSwipeActivate(); // a real distinct heavier cue on the finisher
    this.comboStage = (this.comboStage + 1) % COMBO_MOVES.length;
  }

  /** Real evasive roll: a decisive position burst plus a real invulnerability WINDOW that covers
   * only the early part of the roll (DODGE_IFRAME_SECONDS < DODGE_SECONDS) — the tail end of a
   * dodge is a real committed recovery beat, not free invulnerability for its whole duration. */
  private tryDodge(): void {
    const time = this.clock.elapsedTime;
    if (time - this.lastDodgeTime < DODGE_COOLDOWN_SECONDS) return;
    this.lastDodgeTime = time;
    this.dodgeEndTime = time + DODGE_SECONDS;
    this.dodgeInvulnerableUntil = time + DODGE_IFRAME_SECONDS;
    // Dodges toward wherever the player is actually moving (a real evasive roll goes somewhere
    // deliberate); with no move input held, rolls straight back along the fox's own facing —
    // a real backstep, not a random direction.
    const rawSpeed = Math.hypot(this.rawMoveInput.x, this.rawMoveInput.z);
    if (rawSpeed > 0.1) {
      const relative = toCameraRelative(this.rawMoveInput.x, this.rawMoveInput.z, this.cameraRig.orbitYaw);
      this.dodgeDirection.set(relative.x, 0, relative.z).normalize();
    } else {
      this.dodgeDirection.copy(this.facingForward()).negate();
    }
    this.audio.playDodgeRoll();
  }
}
