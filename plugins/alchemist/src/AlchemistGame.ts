import { AlchemistAudio } from "./audio";
import { MAX_ELEMENT_RANK, getElement, radiusFor } from "./elements";
import {
  INITIAL_TOOLS,
  TOOL_KINDS,
  addTool,
  advanceDangerTimer,
  calculateMergeScore,
  canUseTool,
  consumeTool,
  MAX_CONSECUTIVE_DROPS,
  pickSpawnRank,
  pickToolReward,
  type GamePhase,
  type SpawnContext,
  type ToolInventory,
  type ToolKind,
} from "./model";
import {
  ChamberPhysics,
  COLLISION_ITERATIONS,
  FIXED_STEP,
} from "./physics";
import {
  loadProgress,
  saveBestScore,
  saveDiscovered,
  saveMuted,
  type StorageAdapter,
} from "./storage";

/**
 * Playfield width. Exported because `model.test.ts` asserts that two
 * second-largest atoms fit side by side — the invariant that keeps the final
 * merge reachable — and a copied literal would keep passing after a resize.
 */
export const BOARD_WIDTH = 336;
const BOARD_HEIGHT = 496;
const DANGER_Y = 77;
const DANGER_LIMIT_SECONDS = 1.75;
const GLOW_REWARD_SECONDS = 8;
const GLOW_SPAWN_CHANCE = 0.05;
const DROP_COOLDOWN_SECONDS = 0.8;

interface AtomBody {
  id: number;
  rank: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  grace: number;
  compressed: boolean;
  glowing: boolean;
  glowSeconds: number;
  sleeping: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface MergeEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  label: string;
  color: string;
  particles: Particle[];
}

export interface AlchemistOptions {
  storage: StorageAdapter;
  mode?: "standalone" | "plugin";
  onClose?: () => void;
  random?: () => number;
}

export interface AlchemistHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

interface UiRefs {
  score: HTMLElement;
  best: HTMLElement;
  highestSymbol: HTMLElement;
  pauseButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  dangerFill: HTMLElement;
  dangerText: HTMLElement;
  status: HTMLElement;
  overlay: HTMLElement;
  overlayKicker: HTMLElement;
  overlayTitle: HTMLElement;
  overlayCopy: HTMLElement;
  overlayAction: HTMLButtonElement;
}

const TOOL_COPY: Record<
  ToolKind,
  { title: string; short: string; description: string; glyph: string }
> = {
  proton: {
    title: "Proton Boost",
    short: "Proton",
    description: "Upgrade the atom in your launcher by one element.",
    glyph: "+",
  },
  compress: {
    title: "Electron Compress",
    short: "Compress",
    description: "Select one atom and shrink it by 25% until it merges.",
    glyph: "⇲",
  },
  fusion: {
    title: "Fusion Pulse",
    short: "Fusion",
    description: "Fuse the highest matching pair already in the chamber.",
    glyph: "✦",
  },
  decay: {
    title: "Decay Ray",
    short: "Decay",
    description: "Select one atom to remove it from the chamber.",
    glyph: "−",
  },
};

function queryRequired<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing Alchemist UI element: ${selector}`);
  return value;
}

function renderTools(): string {
  return TOOL_KINDS
    .map((tool) => {
      const item = TOOL_COPY[tool];
      return `
        <button
          class="alchemist-tool"
          type="button"
          data-tool="${tool}"
          aria-label="${item.title}"
          title="${item.description}"
          aria-pressed="false"
        >
          <span class="alchemist-tool-glyph" aria-hidden="true">${item.glyph}</span>
          <span class="alchemist-tool-count" data-tool-count="${tool}">×0</span>
          <span class="alchemist-visually-hidden">${item.title}</span>
        </button>
      `;
    })
    .join("");
}

function createMarkup(mode: "standalone" | "plugin"): string {
  const closeButton =
    mode === "plugin"
      ? `
        <button class="alchemist-menu-button" type="button" data-action="close" aria-label="Close Alchemist" title="Close">
          <span aria-hidden="true">×</span>
        </button>
      `
      : "";

  return `
    <div class="alchemist-app" data-alchemist-root data-phase="ready" data-danger="false">
      <header class="alchemist-header">
        <div class="alchemist-brand">
          <span class="alchemist-brand-mark" aria-hidden="true"><i></i></span>
          <h1>Alchemist</h1>
        </div>
        <button class="alchemist-pause-trigger" type="button" data-action="pause" data-pause aria-label="Pause" title="Pause">
          <span aria-hidden="true">Ⅱ</span>
        </button>
      </header>

      <main class="alchemist-layout">
        <section class="alchemist-game-panel" aria-labelledby="game-heading">
          <div class="alchemist-section-heading alchemist-game-heading">
            <h2 id="game-heading">Reaction</h2>
            <div class="alchemist-highest" aria-label="Highest element this run">
              <span>Peak</span>
              <strong data-highest-symbol>H</strong>
            </div>
          </div>

          <div class="alchemist-score-strip">
            <div><span>Score</span><strong data-score>0</strong></div>
            <div><span>Best</span><strong data-best>0</strong></div>
          </div>

          <div class="alchemist-stage">
            <aside class="alchemist-tools" aria-label="Tools">
              <div class="alchemist-tool-grid">${renderTools()}</div>
            </aside>

            <div class="alchemist-chamber">
              <canvas
                class="alchemist-canvas"
                width="${BOARD_WIDTH}"
                height="${BOARD_HEIGHT}"
                tabindex="0"
                aria-label="Alchemist reaction chamber. Move to aim and click or press Space to drop an atom."
                data-testid="game-canvas"
              ></canvas>

              <div class="alchemist-game-overlay" data-overlay>
                <p data-overlay-kicker>H → Au</p>
                <h3 data-overlay-title>Merge</h3>
                <p data-overlay-copy></p>
                <div class="alchemist-overlay-controls">
                  <button class="alchemist-overlay-primary" type="button" data-overlay-action data-action="overlay">Start</button>
                  <div class="alchemist-pause-menu" data-pause-menu>
                    <button class="alchemist-menu-button" type="button" data-action="restart" aria-label="New run" title="New run">
                      <span aria-hidden="true">↻</span>
                    </button>
                    <button class="alchemist-menu-button" type="button" data-action="mute" aria-label="Mute sound" title="Sound">
                      <span data-sound-glyph aria-hidden="true">♪</span>
                      <span class="alchemist-visually-hidden" data-mute-label>Sound on</span>
                    </button>
                    ${closeButton}
                  </div>
                </div>
              </div>
            </div>

            <div class="alchemist-stage-balance" aria-hidden="true"></div>
          </div>

          <div class="alchemist-danger" aria-live="polite">
            <span data-danger-text></span>
            <div><i data-danger-fill></i></div>
          </div>
          <p class="alchemist-status" data-status aria-live="polite"></p>
        </section>
      </main>
    </div>
  `;
}

class AlchemistGame {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly ui: UiRefs;
  private readonly storage: StorageAdapter;
  private readonly random: () => number;
  private readonly audio: AlchemistAudio;
  private readonly physics = new ChamberPhysics(BOARD_WIDTH, BOARD_HEIGHT);
  private readonly abortController = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private readonly discovered: Set<number>;
  private readonly reducedMotion =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  private bodies: AtomBody[] = [];
  private effects: MergeEffect[] = [];
  private inventory: ToolInventory = { ...INITIAL_TOOLS };
  private phase: GamePhase = "ready";
  private selectedTool: ToolKind | null = null;
  private currentRank = 1;
  private currentGlowing = false;
  private nextRank = 1;
  private lastDropRank = 0;
  private consecutiveDrops = 0;
  private crowded = false;
  private highestRank = 1;
  private score = 0;
  private bestScore: number;
  private aimX = BOARD_WIDTH / 2;
  private aimY = 150;
  private dangerSeconds = 0;
  private dropCooldown = 0;
  private combo = 0;
  private lastMergeAt = -Infinity;
  private bestBeaten = false;
  private simulationSeconds = 0;
  private nextBodyId = 1;
  private frameId = 0;
  private lastFrameAt = 0;
  private accumulator = 0;
  private uiTick = 0;
  private statusTimer = 0;
  private pixelRatio = 1;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: AlchemistOptions,
  ) {
    this.storage = options.storage;
    this.random = options.random ?? Math.random;
    const saved = loadProgress(this.storage);
    this.bestScore = saved.bestScore;
    this.discovered = new Set(saved.discovered);
    this.discovered.add(1);
    this.audio = new AlchemistAudio(saved.muted);

    container.innerHTML = createMarkup(options.mode ?? "standalone");
    this.root = queryRequired(container, "[data-alchemist-root]");
    this.canvas = queryRequired(container, "canvas");
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is not available");
    this.context = context;

    this.ui = {
      score: queryRequired(this.root, "[data-score]"),
      best: queryRequired(this.root, "[data-best]"),
      highestSymbol: queryRequired(this.root, "[data-highest-symbol]"),
      pauseButton: queryRequired(this.root, "[data-pause]"),
      muteButton: queryRequired(this.root, '[data-action="mute"]'),
      dangerFill: queryRequired(this.root, "[data-danger-fill]"),
      dangerText: queryRequired(this.root, "[data-danger-text]"),
      status: queryRequired(this.root, "[data-status]"),
      overlay: queryRequired(this.root, "[data-overlay]"),
      overlayKicker: queryRequired(this.root, "[data-overlay-kicker]"),
      overlayTitle: queryRequired(this.root, "[data-overlay-title]"),
      overlayCopy: queryRequired(this.root, "[data-overlay-copy]"),
      overlayAction: queryRequired(this.root, "[data-overlay-action]"),
    };

    this.ui.score.addEventListener(
      "animationend",
      () => this.ui.score.classList.remove("score-bump"),
      { signal: this.abortController.signal },
    );
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.configureCanvas());
    this.resizeObserver.observe(this.canvas);
    this.configureCanvas();
    this.updateUi(true);
    this.render();
    this.frameId = requestAnimationFrame(this.onAnimationFrame);
  }

  pause(): void {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.setStatus("");
    this.updateUi(true);
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.lastFrameAt = performance.now();
    this.setStatus("");
    this.updateUi(true);
    this.canvas.focus({ preventScroll: true });
  }

  restart(): void {
    this.bodies = [];
    this.effects = [];
    this.inventory = { ...INITIAL_TOOLS };
    this.phase = "playing";
    this.selectedTool = null;
    this.currentRank = 1;
    this.currentGlowing = false;
    this.nextRank = 1;
    this.lastDropRank = 0;
    this.consecutiveDrops = 0;
    this.crowded = false;
    this.highestRank = 1;
    this.score = 0;
    this.aimX = BOARD_WIDTH / 2;
    this.dangerSeconds = 0;
    this.dropCooldown = 0;
    this.combo = 0;
    this.lastMergeAt = -Infinity;
    this.simulationSeconds = 0;
    this.accumulator = 0;
    this.audio.unlock();
    this.audio.click();
    this.setStatus("");
    this.updateUi(true);
    this.canvas.focus({ preventScroll: true });
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    this.abortController.abort();
    this.resizeObserver.disconnect();
    this.audio.destroy();
    this.container.replaceChildren();
  }

  private readonly onAnimationFrame = (timestamp: number): void => {
    const elapsed = this.lastFrameAt
      ? Math.min(0.05, Math.max(0, (timestamp - this.lastFrameAt) / 1000))
      : 0;
    this.lastFrameAt = timestamp;

    if (this.phase === "playing") {
      this.accumulator += elapsed;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < 8) {
        this.step(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        steps += 1;
      }
      if (steps === 8) this.accumulator = 0;
    }

    this.render();
    this.uiTick += elapsed;
    if (this.uiTick >= 0.08) {
      this.uiTick = 0;
      this.updateUi(false);
    }
    this.frameId = requestAnimationFrame(this.onAnimationFrame);
  };

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.root.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        const actionButton = target.closest<HTMLButtonElement>("[data-action]");
        if (actionButton) {
          this.handleAction(actionButton.dataset.action ?? "");
          return;
        }

        const toolButton = target.closest<HTMLButtonElement>("[data-tool]");
        if (toolButton?.dataset.tool) {
          this.handleTool(toolButton.dataset.tool as ToolKind);
        }
      },
      { signal },
    );

    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      "[data-tool]",
    )) {
      const kind = button.dataset.tool as ToolKind;
      button.addEventListener(
        "pointerenter",
        () => {
          if (this.phase !== "playing") return;
          this.setStatus(TOOL_COPY[kind].description);
        },
        { signal },
      );
      button.addEventListener(
        "pointerleave",
        () => {
          if (this.ui.status.textContent === TOOL_COPY[kind].description) {
            this.setStatus("");
          }
        },
        { signal },
      );
    }

    this.canvas.addEventListener(
      "pointermove",
      (event) => {
        const point = this.canvasPoint(event);
        this.aimX = point.x;
        this.aimY = point.y;
      },
      { signal },
    );
    this.canvas.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        this.audio.unlock();
        this.canvas.focus({ preventScroll: true });
        const point = this.canvasPoint(event);
        this.aimX = point.x;
        this.aimY = point.y;
        if (this.selectedTool) this.applyTargetedTool(point.x, point.y);
        else this.dropCurrentAtom();
      },
      { signal },
    );
    this.canvas.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        if (this.selectedTool) {
          this.selectedTool = null;
          this.setStatus("");
          this.updateUi(true);
        }
      },
      { signal },
    );

    this.root.addEventListener(
      "keydown",
      (event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button")) return;
        if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
          event.preventDefault();
          this.aimX -= 18;
        } else if (
          event.key === "ArrowRight" ||
          event.key.toLowerCase() === "d"
        ) {
          event.preventDefault();
          this.aimX += 18;
        } else if (event.code === "Space") {
          event.preventDefault();
          this.dropCurrentAtom();
        } else if (event.key.toLowerCase() === "p") {
          event.preventDefault();
          if (this.phase === "paused") this.resume();
          else this.pause();
        } else if (event.key === "Escape" && this.selectedTool) {
          this.selectedTool = null;
          this.setStatus("");
          this.updateUi(true);
        }
        this.clampAim();
      },
      { signal },
    );

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.pause();
      },
      { signal },
    );
  }

  private handleAction(action: string): void {
    this.audio.unlock();
    if (action === "overlay") {
      if (this.phase === "ready") {
        this.phase = "playing";
        this.setStatus("");
        this.audio.click();
        this.canvas.focus({ preventScroll: true });
      } else if (this.phase === "paused") {
        this.resume();
      } else if (this.phase === "won" || this.phase === "lost") {
        this.restart();
      }
      this.updateUi(true);
    } else if (action === "pause") {
      if (this.phase === "paused") this.resume();
      else this.pause();
    } else if (action === "restart") {
      this.restart();
    } else if (action === "mute") {
      const muted = !this.audio.isMuted;
      this.audio.setMuted(muted);
      saveMuted(this.storage, muted);
      if (!muted) {
        this.audio.unlock();
        this.audio.click();
      }
      this.setStatus(muted ? "Sound off" : "Sound on");
      this.updateUi(true);
    } else if (action === "close") {
      this.options.onClose?.();
    }
  }

  private handleTool(tool: ToolKind): void {
    if (this.phase !== "playing") {
      this.setStatus("Paused");
      return;
    }
    if (!canUseTool(this.inventory, tool)) {
      this.setStatus("Empty");
      return;
    }

    this.audio.unlock();
    if (tool === "proton") {
      if (this.currentRank >= MAX_ELEMENT_RANK) {
        this.setStatus("Max");
        return;
      }
      this.currentRank += 1;
      this.inventory = consumeTool(this.inventory, tool);
      this.audio.tool();
      this.setStatus(getElement(this.currentRank).symbol);
      this.updateUi(true);
      return;
    }

    if (tool === "fusion") {
      const pair = this.findFusionPair();
      if (!pair) {
        this.setStatus("No pair");
        return;
      }
      this.inventory = consumeTool(this.inventory, tool);
      this.audio.tool();
      this.mergeBodies(pair[0], pair[1], true);
      this.updateUi(true);
      return;
    }

    this.selectedTool = this.selectedTool === tool ? null : tool;
    if (this.selectedTool) {
      this.setStatus("Select atom");
    } else {
      this.setStatus("");
    }
    this.updateUi(true);
  }

  private applyTargetedTool(x: number, y: number): void {
    const tool = this.selectedTool;
    if (!tool) return;
    const body = [...this.bodies]
      .reverse()
      .find((candidate) => Math.hypot(candidate.x - x, candidate.y - y) <= candidate.radius);
    if (!body) {
      this.setStatus("Select atom");
      return;
    }

    const earnsGlowReward =
      tool === "decay" &&
      body.glowing &&
      body.glowSeconds > 0;
    if (tool === "compress") {
      if (body.compressed) {
        this.setStatus("Already compressed");
        return;
      }
      const previousRadius = body.radius;
      body.radius *= 0.75;
      body.mass = body.radius ** 2;
      body.compressed = true;
      this.physics.wakeNear(
        this.bodies,
        body.x,
        body.y,
        previousRadius + 14,
      );
      this.inventory = consumeTool(this.inventory, tool);
      this.addEffect(body.x, body.y, "COMPRESSED", getElement(body.rank).color);
    } else if (tool === "decay") {
      this.physics.wakeNear(this.bodies, body.x, body.y, body.radius + 14);
      this.bodies = this.bodies.filter((candidate) => candidate.id !== body.id);
      this.inventory = consumeTool(this.inventory, tool);
      this.addEffect(body.x, body.y, "DECAYED", "#c16882");
    } else {
      return;
    }

    this.audio.tool();
    this.selectedTool = null;
    this.setStatus(TOOL_COPY[tool].short);
    if (earnsGlowReward) this.grantToolReward(body.x, body.y);
    this.updateUi(true);
  }

  private dropCurrentAtom(): void {
    if (this.phase !== "playing" || this.dropCooldown > 0) return;
    this.clampAim();
    const rank = this.currentRank;
    const body = this.createBody(
      rank,
      this.aimX,
      Math.max(radiusFor(rank) + 2, 36),
      0,
      8,
      this.currentGlowing,
    );
    body.grace = 1;
    this.bodies.push(body);
    this.discover(rank);
    this.audio.drop(rank);
    this.consecutiveDrops =
      rank === this.lastDropRank ? this.consecutiveDrops + 1 : 1;
    this.lastDropRank = rank;
    this.currentRank = this.nextRank;
    this.nextRank = this.sampleNextRank();
    this.currentGlowing = this.random() < GLOW_SPAWN_CHANCE;
    this.dropCooldown = DROP_COOLDOWN_SECONDS;
    this.updateUi(true);
  }

  private sampleNextRank(): number {
    const context: SpawnContext = {
      crowded: this.crowded,
    };
    const projectedStreak =
      this.currentRank === this.lastDropRank
        ? this.consecutiveDrops + 1
        : 1;
    return pickSpawnRank(
      context,
      projectedStreak >= MAX_CONSECUTIVE_DROPS ? this.currentRank : null,
      this.random,
    );
  }

  private step(delta: number): void {
    this.simulationSeconds += delta;
    this.dropCooldown = Math.max(0, this.dropCooldown - delta);
    this.statusTimer = Math.max(0, this.statusTimer - delta);
    this.updateEffects(delta);

    for (const body of this.bodies) {
      body.grace = Math.max(0, body.grace - delta);
      body.glowSeconds = Math.max(0, body.glowSeconds - delta);
      if (body.glowSeconds === 0) body.glowing = false;
      this.physics.integrate(body, delta);
      this.physics.resolveBounds(body);
    }

    const claimed = new Set<number>();
    const mergePairs: Array<[AtomBody, AtomBody]> = [];
    for (let iteration = 0; iteration < COLLISION_ITERATIONS; iteration += 1) {
      for (let leftIndex = 0; leftIndex < this.bodies.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < this.bodies.length;
          rightIndex += 1
        ) {
          const left = this.bodies[leftIndex];
          const right = this.bodies[rightIndex];
          if (!left || !right) continue;
          const dx = right.x - left.x;
          const dy = right.y - left.y;
          const minimumDistance = left.radius + right.radius;
          if (dx * dx + dy * dy >= minimumDistance * minimumDistance) continue;

          if (
            iteration === 0 &&
            left.rank === right.rank &&
            left.rank < MAX_ELEMENT_RANK &&
            !claimed.has(left.id) &&
            !claimed.has(right.id)
          ) {
            claimed.add(left.id);
            claimed.add(right.id);
            mergePairs.push([left, right]);
            continue;
          }
          if (claimed.has(left.id) || claimed.has(right.id)) continue;
          const impact = this.physics.collide(left, right, iteration === 0);
          if (iteration === 0 && impact > 0) this.audio.collision(impact);
        }
      }
    }

    for (const [left, right] of mergePairs) {
      if (this.phase !== "playing") break;
      if (
        this.bodies.some((body) => body.id === left.id) &&
        this.bodies.some((body) => body.id === right.id)
      ) {
        this.mergeBodies(left, right, false);
      }
    }

    this.physics.settle(this.bodies);
    if (this.phase !== "playing") return;
    this.crowded = this.bodies.some(
      (body) =>
        body.grace <= 0 &&
        body.y - body.radius < BOARD_HEIGHT * 0.25,
    );
    const dangerActive = this.bodies.some(
      (body) =>
        body.grace <= 0 &&
        body.y - body.radius < DANGER_Y &&
        Math.abs(body.vy) < 180,
    );
    this.dangerSeconds = advanceDangerTimer(
      this.dangerSeconds,
      dangerActive,
      delta,
    );
    if (this.dangerSeconds >= DANGER_LIMIT_SECONDS) this.finish("lost");
  }

  private mergeBodies(
    left: AtomBody,
    right: AtomBody,
    remote: boolean,
  ): void {
    const resultRank = left.rank + 1;
    if (resultRank > MAX_ELEMENT_RANK) return;
    const glowRewards =
      Number(left.glowing && left.glowSeconds > 0) +
      Number(right.glowing && right.glowSeconds > 0);
    this.bodies = this.bodies.filter(
      (body) => body.id !== left.id && body.id !== right.id,
    );

    const x = (left.x + right.x) / 2;
    const y = (left.y + right.y) / 2;
    const result = this.createBody(
      resultRank,
      x,
      y,
      (left.vx + right.vx) / 2,
      remote ? -75 : (left.vy + right.vy) / 2 - 28,
    );
    result.grace = 0.65;
    this.bodies.push(result);
    this.physics.wakeNear(this.bodies, x, y, result.radius + 18);

    this.combo =
      this.simulationSeconds - this.lastMergeAt <= 1.2 ? this.combo + 1 : 1;
    this.lastMergeAt = this.simulationSeconds;
    const points = calculateMergeScore(resultRank, this.combo);
    this.score += points;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      saveBestScore(this.storage, this.bestScore);
      if (!this.bestBeaten) {
        this.bestBeaten = true;
        this.setStatus("NEW BEST");
      }
    }

    const element = getElement(resultRank);
    this.addEffect(x, y, `+${points}`, element.color);
    this.audio.merge(resultRank, this.combo);
    this.discover(resultRank);
    for (let reward = 0; reward < glowRewards; reward += 1) {
      this.grantToolReward(x, y);
    }
    if (resultRank === MAX_ELEMENT_RANK) this.finish("won");
    this.updateUi(true);
  }

  private findFusionPair(): [AtomBody, AtomBody] | null {
    let best: [AtomBody, AtomBody] | null = null;
    let bestRank = -1;
    let bestDistance = Infinity;
    for (let leftIndex = 0; leftIndex < this.bodies.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < this.bodies.length;
        rightIndex += 1
      ) {
        const left = this.bodies[leftIndex];
        const right = this.bodies[rightIndex];
        if (
          !left ||
          !right ||
          left.rank !== right.rank ||
          left.rank >= MAX_ELEMENT_RANK
        ) {
          continue;
        }
        const distance = Math.hypot(left.x - right.x, left.y - right.y);
        if (
          left.rank > bestRank ||
          (left.rank === bestRank && distance < bestDistance)
        ) {
          best = [left, right];
          bestRank = left.rank;
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  private finish(result: "won" | "lost"): void {
    if (this.phase === "won" || this.phase === "lost") return;
    this.phase = result;
    this.selectedTool = null;
    if (result === "won") {
      this.setStatus("Au");
      this.audio.win();
    } else {
      this.setStatus("Overload");
      this.audio.lose();
    }
    this.updateUi(true);
  }

  private discover(rank: number): void {
    if (rank > this.highestRank) {
      this.highestRank = rank;
    }
    if (!this.discovered.has(rank)) {
      this.discovered.add(rank);
      saveDiscovered(this.storage, this.discovered);
    }
  }

  private createBody(
    rank: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    glowing = false,
  ): AtomBody {
    const radius = radiusFor(rank);
    return {
      id: this.nextBodyId++,
      rank,
      x: Math.max(radius, Math.min(BOARD_WIDTH - radius, x)),
      y,
      vx,
      vy,
      radius,
      mass: radius ** 2,
      grace: 0,
      compressed: false,
      glowing,
      glowSeconds: glowing ? GLOW_REWARD_SECONDS : 0,
      sleeping: false,
    };
  }

  private grantToolReward(x: number, y: number): void {
    const tool = pickToolReward(this.random);
    this.inventory = addTool(this.inventory, tool);
    this.addEffect(x, y, `+1 ${TOOL_COPY[tool].short}`, "#f7c74b");
    this.setStatus(`+1 ${TOOL_COPY[tool].short}`);
    this.audio.tool();
  }

  private addEffect(x: number, y: number, label: string, color: string): void {
    const particleCount = this.reducedMotion ? 4 : 10;
    const particles: Particle[] = Array.from(
      { length: particleCount },
      (_, index) => {
        const angle = (index / particleCount) * Math.PI * 2;
        const speed = 38 + this.random() * 52;
        return {
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.8 + this.random() * 2.8,
          color,
        };
      },
    );
    this.effects.push({
      x,
      y,
      life: 0.75,
      maxLife: 0.75,
      label,
      color,
      particles,
    });
  }

  private updateEffects(delta: number): void {
    for (const effect of this.effects) {
      effect.life -= delta;
      for (const particle of effect.particles) {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += 90 * delta;
        particle.vx *= 0.98;
      }
    }
    this.effects = this.effects.filter((effect) => effect.life > 0);
  }

  private configureCanvas(): void {
    this.pixelRatio = Math.min(2.5, Math.max(1, globalThis.devicePixelRatio ?? 1));
    const width = Math.round(BOARD_WIDTH * this.pixelRatio);
    const height = Math.round(BOARD_HEIGHT * this.pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.render();
  }

  private render(): void {
    const context = this.context;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    this.drawBackdrop();

    const dangerRatio = Math.min(
      1,
      this.dangerSeconds / DANGER_LIMIT_SECONDS,
    );
    if (dangerRatio > 0) {
      context.fillStyle = `rgba(190, 58, 63, ${0.05 + dangerRatio * 0.13})`;
      context.fillRect(0, 0, BOARD_WIDTH, DANGER_Y);
    }
    context.save();
    context.strokeStyle =
      dangerRatio > 0
        ? `rgba(178, 40, 48, ${0.5 + dangerRatio * 0.45})`
        : "rgba(48, 78, 82, 0.32)";
    context.lineWidth = 1.15;
    context.setLineDash([3, 7]);
    context.beginPath();
    context.moveTo(22, DANGER_Y);
    context.lineTo(BOARD_WIDTH - 22, DANGER_Y);
    context.stroke();
    context.setLineDash([]);
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(18, DANGER_Y - 5);
    context.lineTo(18, DANGER_Y + 5);
    context.moveTo(BOARD_WIDTH - 18, DANGER_Y - 5);
    context.lineTo(BOARD_WIDTH - 18, DANGER_Y + 5);
    context.stroke();
    context.restore();

    this.drawNextPreview();

    if (this.phase === "playing" || this.phase === "paused") {
      const radius = radiusFor(this.currentRank);
      this.aimX = Math.max(radius + 3, Math.min(BOARD_WIDTH - radius - 3, this.aimX));
      context.setLineDash([5, 8]);
      context.strokeStyle = "rgba(36, 78, 82, 0.32)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(this.aimX, 56);
      context.lineTo(this.aimX, BOARD_HEIGHT - 14);
      context.stroke();
      context.setLineDash([]);

      const previewY = Math.max(radius + 2, 36);
      const cooldownProgress = 1 - Math.min(
        1,
        this.dropCooldown / DROP_COOLDOWN_SECONDS,
      );
      this.drawAtom(
        this.aimX,
        previewY,
        radius * (0.7 + 0.3 * cooldownProgress),
        this.currentRank,
        0.5 + 0.48 * cooldownProgress,
        false,
        this.currentGlowing ? 1 : 0,
      );
      if (cooldownProgress < 1) {
        context.save();
        context.strokeStyle = "rgba(231, 175, 63, 0.95)";
        context.lineWidth = 2.5;
        context.lineCap = "round";
        context.beginPath();
        context.arc(
          this.aimX,
          previewY,
          radius + 9,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * cooldownProgress,
        );
        context.stroke();
        context.lineCap = "butt";
        context.restore();
      }
    }

    for (const body of this.bodies) {
      context.save();
      context.fillStyle = "rgba(32, 46, 52, 0.14)";
      context.beginPath();
      context.ellipse(
        body.x + 1,
        body.y + body.radius * 0.78,
        body.radius * 0.68,
        body.radius * 0.2,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.restore();
      this.drawAtom(
        body.x,
        body.y,
        body.radius,
        body.rank,
        1,
        body.compressed,
        body.glowing
          ? body.glowSeconds / GLOW_REWARD_SECONDS
          : 0,
      );
    }

    if (this.selectedTool === "compress" || this.selectedTool === "decay") {
      const target = [...this.bodies]
        .reverse()
        .find(
          (candidate) =>
            Math.hypot(candidate.x - this.aimX, candidate.y - this.aimY) <=
            candidate.radius,
        );
      context.save();
      context.setLineDash([5, 5]);
      if (target) {
        context.strokeStyle = "rgba(231, 175, 63, 0.9)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(target.x, target.y, target.radius + 6, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.strokeStyle = "rgba(225, 165, 56, 0.75)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(this.aimX, this.aimY, 17, 0, Math.PI * 2);
        context.moveTo(this.aimX - 27, this.aimY);
        context.lineTo(this.aimX + 27, this.aimY);
        context.moveTo(this.aimX, this.aimY - 27);
        context.lineTo(this.aimX, this.aimY + 27);
        context.stroke();
      }
      context.setLineDash([]);
      context.restore();
    }

    for (const effect of this.effects) this.drawEffect(effect);
  }

  private drawBackdrop(): void {
    const context = this.context;
    const background = context.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
    background.addColorStop(0, "#e7eef0");
    background.addColorStop(0.18, "#e4ebe4");
    background.addColorStop(0.55, "#ead8b6");
    background.addColorStop(1, "#c99668");
    context.fillStyle = background;
    context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.16)";
    context.lineWidth = 1;
    for (let band = 1; band <= 5; band += 1) {
      const y = 28 + band * 78;
      context.globalAlpha = 0.35 - band * 0.04;
      context.beginPath();
      context.moveTo(10, y);
      context.bezierCurveTo(90, y - 4, 230, y + 5, BOARD_WIDTH - 10, y);
      context.stroke();
    }
    context.restore();

    const centerX = BOARD_WIDTH / 2;
    const centerY = BOARD_HEIGHT * 0.64;
    const ringRadius = 118;
    context.save();
    context.strokeStyle = "rgba(72, 92, 88, 0.1)";
    context.lineWidth = 1.25;
    context.beginPath();
    context.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, ringRadius * 0.68, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    for (let corner = 0; corner < 3; corner += 1) {
      const angle = -Math.PI / 2 + (corner * Math.PI * 2) / 3;
      const pointX = centerX + Math.cos(angle) * ringRadius;
      const pointY = centerY + Math.sin(angle) * ringRadius;
      if (corner === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    }
    context.closePath();
    context.stroke();
    context.restore();

    const sediment = context.createLinearGradient(
      0,
      BOARD_HEIGHT - 36,
      0,
      BOARD_HEIGHT,
    );
    sediment.addColorStop(0, "rgba(138, 78, 36, 0)");
    sediment.addColorStop(1, "rgba(120, 62, 28, 0.16)");
    context.fillStyle = sediment;
    context.fillRect(0, BOARD_HEIGHT - 36, BOARD_WIDTH, 36);

    const vignette = context.createRadialGradient(
      centerX,
      BOARD_HEIGHT * 0.5,
      BOARD_WIDTH * 0.28,
      centerX,
      BOARD_HEIGHT * 0.52,
      BOARD_HEIGHT * 0.74,
    );
    vignette.addColorStop(0, "rgba(28, 48, 52, 0)");
    vignette.addColorStop(1, "rgba(28, 48, 52, 0.1)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }

  private drawNextPreview(): void {
    if (this.phase !== "playing" && this.phase !== "paused") return;
    const context = this.context;
    const badgeWidth = 52;
    const badgeHeight = 54;
    const badgeX = BOARD_WIDTH - badgeWidth - 10;
    const badgeY = 10;

    context.save();
    context.fillStyle = "rgba(248, 252, 252, 0.9)";
    context.strokeStyle = "rgba(70, 96, 92, 0.22)";
    context.lineWidth = 1;
    context.shadowColor = "rgba(28, 48, 52, 0.12)";
    context.shadowBlur = 6;
    context.shadowOffsetY = 2;
    context.beginPath();
    context.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 11);
    context.fill();
    context.stroke();
    context.shadowColor = "transparent";

    context.fillStyle = "#3d5a56";
    context.font = '800 9px "Avenir Next", "Trebuchet MS", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillText("NEXT", badgeX + badgeWidth / 2, badgeY + 15);

    const element = getElement(this.nextRank);
    const miniRadius = Math.max(8, Math.min(15, element.radius * 0.42));
    this.drawAtom(
      badgeX + badgeWidth / 2,
      badgeY + 34,
      miniRadius,
      this.nextRank,
      1,
      false,
      0,
    );
    context.restore();
  }

  private drawAtom(
    x: number,
    y: number,
    radius: number,
    rank: number,
    alpha: number,
    compressed: boolean,
    glowRatio: number,
  ): void {
    const context = this.context;
    const element = getElement(rank);
    context.save();
    context.globalAlpha = alpha;

    if (glowRatio > 0) {
      const pulse = this.reducedMotion
        ? 0.5
        : 0.5 + Math.sin(this.simulationSeconds * 7) * 0.5;
      const halo = context.createRadialGradient(
        x,
        y,
        radius * 0.7,
        x,
        y,
        radius * (1.48 + pulse * 0.08),
      );
      halo.addColorStop(0, "rgba(255, 244, 164, 0.28)");
      halo.addColorStop(0.55, "rgba(255, 207, 70, 0.16)");
      halo.addColorStop(1, "rgba(255, 190, 42, 0)");
      context.fillStyle = halo;
      context.beginPath();
      context.arc(x, y, radius * 1.58, 0, Math.PI * 2);
      context.fill();
    }

    const body = context.createRadialGradient(
      x - radius * 0.32,
      y - radius * 0.4,
      radius * 0.06,
      x + radius * 0.08,
      y + radius * 0.16,
      radius,
    );
    body.addColorStop(0, "#fff7e6");
    body.addColorStop(0.1, element.lightColor);
    body.addColorStop(0.52, element.color);
    body.addColorStop(0.86, element.darkColor);
    body.addColorStop(1, "#120c10");
    context.fillStyle = body;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    context.lineWidth = Math.max(1, radius * 0.045);
    context.strokeStyle = "rgba(255, 255, 255, 0.22)";
    context.beginPath();
    context.arc(x, y, radius - context.lineWidth * 0.6, Math.PI * 1.02, Math.PI * 1.72);
    context.stroke();
    context.strokeStyle = "rgba(10, 12, 18, 0.28)";
    context.beginPath();
    context.arc(x, y, radius - 0.7, Math.PI * 1.78, Math.PI * 2.92);
    context.stroke();

    if (radius > 16) {
      context.save();
      const spin = this.reducedMotion ? 0 : this.simulationSeconds * 0.32;
      context.strokeStyle = "rgba(255, 255, 255, 0.16)";
      context.lineWidth = Math.max(0.7, radius * 0.028);
      context.beginPath();
      context.ellipse(
        x,
        y,
        radius * 0.74,
        radius * 0.46,
        spin,
        0,
        Math.PI * 2,
      );
      context.stroke();
      context.restore();
    }

    context.fillStyle = "rgba(255, 255, 255, 0.42)";
    context.beginPath();
    context.ellipse(
      x - radius * 0.34,
      y - radius * 0.42,
      radius * 0.26,
      radius * 0.13,
      -Math.PI / 5.2,
      0,
      Math.PI * 2,
    );
    context.fill();

    if (rank >= 9) {
      context.lineCap = "round";
      context.strokeStyle = "rgba(255, 255, 255, 0.26)";
      context.lineWidth = radius * 0.12;
      context.beginPath();
      context.arc(x, y, radius * 0.6, Math.PI * 1.08, Math.PI * 1.5);
      context.stroke();
      context.strokeStyle = "rgba(255, 255, 255, 0.1)";
      context.beginPath();
      context.arc(x, y, radius * 0.6, Math.PI * 1.68, Math.PI * 1.9);
      context.stroke();
      context.lineCap = "butt";
    }

    if (rank === MAX_ELEMENT_RANK) {
      const twinkle = this.reducedMotion
        ? 0.7
        : 0.45 + 0.4 * Math.sin(this.simulationSeconds * 3 + x * 0.05);
      this.drawSparkle(
        x + radius * 0.44,
        y - radius * 0.3,
        radius * 0.16,
        twinkle,
      );
      this.drawSparkle(
        x - radius * 0.5,
        y + radius * 0.14,
        radius * 0.1,
        1.15 - twinkle,
      );
    }

    if (compressed) {
      context.setLineDash([3, 3]);
      context.strokeStyle = "rgba(255, 242, 183, 0.95)";
      context.lineWidth = 1.4;
      context.beginPath();
      context.arc(x, y, radius + 4, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }

    if (glowRatio > 0) {
      context.shadowColor = "rgba(255, 197, 50, 0.8)";
      context.shadowBlur = 8;
      context.strokeStyle = "rgba(255, 231, 126, 0.96)";
      context.lineWidth = 2;
      context.lineCap = "round";
      context.beginPath();
      context.arc(
        x,
        y,
        radius + 5,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, glowRatio)),
      );
      context.stroke();
      context.lineCap = "butt";
    }

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `800 ${Math.max(10, radius * 0.58)}px "Avenir Next", "Trebuchet MS", sans-serif`;
    context.lineJoin = "round";
    context.lineWidth = Math.max(2.2, radius * 0.1);
    context.strokeStyle = "rgba(12, 10, 16, 0.55)";
    context.strokeText(element.symbol, x, y + 0.5);
    context.fillStyle = "#fffdf8";
    context.fillText(element.symbol, x, y + 0.5);

    context.restore();
  }

  private drawSparkle(
    x: number,
    y: number,
    size: number,
    alpha: number,
  ): void {
    const context = this.context;
    context.save();
    context.globalAlpha *= Math.max(0, Math.min(1, alpha));
    context.fillStyle = "#fff8dc";
    context.beginPath();
    context.moveTo(x, y - size);
    context.quadraticCurveTo(x + size * 0.2, y - size * 0.2, x + size, y);
    context.quadraticCurveTo(x + size * 0.2, y + size * 0.2, x, y + size);
    context.quadraticCurveTo(x - size * 0.2, y + size * 0.2, x - size, y);
    context.quadraticCurveTo(x - size * 0.2, y - size * 0.2, x, y - size);
    context.fill();
    context.restore();
  }

  private drawEffect(effect: MergeEffect): void {
    const context = this.context;
    const progress = 1 - effect.life / effect.maxLife;
    const alpha = Math.max(0, effect.life / effect.maxLife);
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = effect.color;
    context.lineWidth = 3 - progress * 2;
    context.beginPath();
    context.arc(effect.x, effect.y, 18 + progress * 48, 0, Math.PI * 2);
    context.stroke();
    for (const particle of effect.particles) {
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "#1f3d42";
    context.font = '800 13px "Avenir Next", sans-serif';
    context.textAlign = "center";
    context.fillText(effect.label, effect.x, effect.y - 30 - progress * 22);
    context.restore();
  }

  private updateUi(force: boolean): void {
    this.root.dataset.phase = this.phase;
    this.canvas.setAttribute(
      "aria-label",
      `Alchemist reaction chamber. Next atom: ${getElement(this.nextRank).symbol}. Move to aim and click or press Space to drop an atom.`,
    );
    const dangerRatio = Math.min(
      1,
      this.dangerSeconds / DANGER_LIMIT_SECONDS,
    );
    this.root.dataset.danger = String(dangerRatio > 0);
    this.root.dataset.dangerCritical = String(dangerRatio > 0.6);
    this.root.dataset.bestBeaten = String(this.bestBeaten);
    this.ui.dangerFill.style.width = `${dangerRatio * 100}%`;
    this.ui.dangerText.textContent =
      dangerRatio > 0
        ? `Danger ${(DANGER_LIMIT_SECONDS - this.dangerSeconds).toFixed(1)}s`
        : "";

    if (!force && this.statusTimer <= 0) this.ui.status.textContent = "";
    const scoreText = this.score.toLocaleString("en-US");
    if (this.ui.score.textContent !== scoreText) {
      if (this.score > 0) this.bumpScore();
      this.ui.score.textContent = scoreText;
    }
    this.ui.best.textContent = this.bestScore.toLocaleString("en-US");

    const highest = getElement(this.highestRank);
    this.ui.highestSymbol.textContent = highest.symbol;
    this.ui.highestSymbol.style.color = highest.color;
    this.ui.pauseButton.disabled = this.phase !== "playing";

    const muteLabel = queryRequired<HTMLElement>(
      this.ui.muteButton,
      "[data-mute-label]",
    );
    const soundGlyph = queryRequired<HTMLElement>(
      this.ui.muteButton,
      "[data-sound-glyph]",
    );
    muteLabel.textContent = this.audio.isMuted ? "Sound off" : "Sound on";
    soundGlyph.textContent = this.audio.isMuted ? "∅" : "♪";
    this.ui.muteButton.setAttribute(
      "aria-label",
      this.audio.isMuted ? "Enable sound" : "Mute sound",
    );

    for (const tool of TOOL_KINDS) {
      const button = queryRequired<HTMLButtonElement>(
        this.root,
        `[data-tool="${tool}"]`,
      );
      const count = queryRequired<HTMLElement>(
        button,
        `[data-tool-count="${tool}"]`,
      );
      count.textContent = `×${this.inventory[tool]}`;
      button.disabled =
        this.phase !== "playing" || !canUseTool(this.inventory, tool);
      button.setAttribute(
        "aria-pressed",
        String(this.selectedTool === tool),
      );
    }

    this.updateOverlay();
  }

  private updateOverlay(): void {
    const visible = this.phase !== "playing";
    this.ui.overlay.hidden = !visible;
    if (!visible) return;

    if (this.phase === "ready") {
      this.ui.overlayKicker.textContent = "H → Au";
      this.ui.overlayTitle.textContent = "Merge";
      this.ui.overlayCopy.textContent = "";
      this.ui.overlayAction.textContent = "Start";
    } else if (this.phase === "paused") {
      this.ui.overlayKicker.textContent = "";
      this.ui.overlayTitle.textContent = "Paused";
      this.ui.overlayCopy.textContent = "";
      this.ui.overlayAction.textContent = "Resume";
    } else if (this.phase === "won") {
      this.ui.overlayKicker.textContent = "Au";
      this.ui.overlayTitle.textContent = "Complete";
      this.ui.overlayCopy.textContent = this.score.toLocaleString("en-US");
      this.ui.overlayAction.textContent = "Again";
    } else {
      this.ui.overlayKicker.textContent = "Overload";
      this.ui.overlayTitle.textContent = "Full";
      this.ui.overlayCopy.textContent = this.score.toLocaleString("en-US");
      this.ui.overlayAction.textContent = "Again";
    }
  }

  private bumpScore(): void {
    if (this.reducedMotion) return;
    const element = this.ui.score;
    element.classList.remove("score-bump");
    void element.offsetWidth;
    element.classList.add("score-bump");
  }

  private setStatus(message: string): void {
    this.ui.status.textContent = message;
    this.statusTimer = message ? 2.2 : 0;
  }

  private canvasPoint(event: PointerEvent): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * BOARD_WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * BOARD_HEIGHT,
    };
  }

  private clampAim(): void {
    const radius = radiusFor(this.currentRank);
    this.aimX = Math.max(
      radius + 3,
      Math.min(BOARD_WIDTH - radius - 3, this.aimX),
    );
  }
}

export function mountAlchemist(
  container: HTMLElement,
  options: AlchemistOptions,
): AlchemistHandle {
  const game = new AlchemistGame(container, options);
  return {
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => game.restart(),
    destroy: () => game.destroy(),
  };
}
