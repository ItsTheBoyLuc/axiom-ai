import { backgroundConfig as cfg } from './config';

/**
 * The fixed, full-viewport background of the cinematic routes: a canvas network whose state is
 * scrubbed to scroll position.
 *
 * - Three depth layers of nodes (large labelled provider nodes, medium model nodes, small ambient
 *   particles), plus a grid and two glows, each scrolling at its own parallax speed.
 * - One "formation" per page section (hero orbit, dense core, lattice, ring, two columns, timeline
 *   spine, spiral, convergence): nodes glide between the formations of the sections the viewport
 *   centre is between, and the camera zoom/pan, glow colour and position change with them.
 * - Always alive: slow idle drift, breathing glows, light pulses along links, cursor attraction.
 *
 * It only reads scroll position (it needs neither GSAP nor Lenis), so it keeps working whatever
 * drives scrolling. Purely presentational (`aria-hidden`); the same links exist as real links in
 * the page. Everything here is canvas drawing: no layout, nothing in the DOM changes per frame.
 */

export type BackgroundSeed = {
  providers: { slug: string; name: string }[];
  models: { slug: string; name: string; providerSlug: string }[];
};

export type BackgroundOptions = {
  mobile: boolean;
  /** Called with a href when a node is clicked in the hero. */
  navigate: (href: string) => void;
  /** Seconds the network takes to fade in from the centre (0 = immediately). */
  reveal: number;
};

export type BackgroundStatus = {
  frames: number;
  /** Adaptive quality level: 0 full, 1 lighter, 2 lightest. */
  quality: number;
  /** Section position (fractional index) the scene is showing. */
  f: number;
  fps: { p50: number; p95: number; slowFrames: number; sampled: number };
  nodes: number;
  particles: number;
};

export type Background = {
  status: () => BackgroundStatus;
  /** Re-reads section positions (call after layout changes, e.g. ScrollTrigger refresh). */
  measure: () => void;
  destroy: () => void;
};

// ------------------------------------------------------------------------------- formations

type Pt = { x: number; y: number };
type Kind = 'provider' | 'model' | 'particle';
type Node = {
  kind: Kind;
  label: string;
  href: string;
  /** Index of the parent provider node (models), else -1. */
  parent: number;
  /** Layer depth 0..1: scroll parallax and size follow it. */
  depth: number;
  radius: number;
  phase: number;
  /** Position in each formation (normalised, -1..1). */
  at: Pt[];
};

type Formation = {
  name: string;
  cam: { zoom: number; x: number; y: number; rot: number };
  glow: { x: number; y: number; r: number; c: 0 | 1 | 2; a: number }[];
  grid: { angle: number; spacing: number; alpha: number };
  /** Multiplier of link visibility in this formation. */
  links: number;
};

const FORMATIONS: Formation[] = [
  {
    name: 'hero',
    cam: { zoom: 1, x: 0, y: 0, rot: 0 },
    glow: [
      { x: 0, y: 0.05, r: 0.95, c: 0, a: 0.34 },
      { x: -0.6, y: -0.5, r: 0.6, c: 1, a: 0.16 },
    ],
    grid: { angle: 0, spacing: 0.16, alpha: 0.5 },
    links: 1,
  },
  {
    name: 'stats',
    cam: { zoom: 1.5, x: 0, y: 0, rot: 0.06 },
    glow: [
      { x: 0, y: 0, r: 0.8, c: 1, a: 0.4 },
      { x: 0.7, y: 0.4, r: 0.5, c: 0, a: 0.18 },
    ],
    grid: { angle: 0.1, spacing: 0.1, alpha: 0.65 },
    links: 1.5,
  },
  {
    name: 'featured',
    cam: { zoom: 1.12, x: -0.22, y: 0, rot: 0 },
    glow: [
      { x: 0.65, y: -0.2, r: 0.85, c: 2, a: 0.34 },
      { x: -0.7, y: 0.5, r: 0.5, c: 0, a: 0.15 },
    ],
    grid: { angle: 0, spacing: 0.2, alpha: 0.6 },
    links: 0.7,
  },
  {
    name: 'providers',
    cam: { zoom: 0.9, x: 0, y: 0, rot: 0.18 },
    glow: [
      { x: 0, y: 0, r: 1.0, c: 0, a: 0.36 },
      { x: 0.8, y: -0.7, r: 0.5, c: 2, a: 0.14 },
    ],
    grid: { angle: 0.3, spacing: 0.14, alpha: 0.45 },
    links: 1.2,
  },
  {
    name: 'compare',
    cam: { zoom: 1, x: 0, y: 0.05, rot: 0 },
    glow: [
      { x: -0.7, y: 0, r: 0.8, c: 0, a: 0.3 },
      { x: 0.7, y: 0, r: 0.8, c: 1, a: 0.3 },
    ],
    grid: { angle: 0, spacing: 0.12, alpha: 0.55 },
    links: 1.6,
  },
  {
    name: 'releases',
    cam: { zoom: 1.2, x: 0.28, y: 0, rot: 0 },
    glow: [
      { x: 0.55, y: 0.2, r: 0.9, c: 1, a: 0.32 },
      { x: -0.8, y: -0.4, r: 0.5, c: 2, a: 0.16 },
    ],
    grid: { angle: 1.5708, spacing: 0.18, alpha: 0.5 },
    links: 0.5,
  },
  {
    name: 'news',
    cam: { zoom: 0.82, x: 0, y: 0, rot: 0.5 },
    glow: [
      { x: 0, y: 0, r: 1.1, c: 2, a: 0.34 },
      { x: -0.6, y: 0.6, r: 0.6, c: 0, a: 0.18 },
    ],
    grid: { angle: 0.7, spacing: 0.16, alpha: 0.4 },
    links: 0.9,
  },
  {
    name: 'cta',
    cam: { zoom: 1.3, x: 0, y: 0, rot: 0 },
    glow: [
      { x: 0, y: 0, r: 0.85, c: 0, a: 0.5 },
      { x: 0, y: 0, r: 1.3, c: 1, a: 0.16 },
    ],
    grid: { angle: 0, spacing: 0.1, alpha: 0.3 },
    links: 1.3,
  },
];

/** Section names (data-cine-state) to formation indexes. Unknown names cycle through formations. */
const FORMATION_INDEX: Record<string, number> = Object.fromEntries(
  FORMATIONS.map((f, i) => [f.name, i]),
);

/** Small seeded PRNG so the layout is identical on every load. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 0.9;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function buildNodes(seed: BackgroundSeed, particleCount: number): Node[] {
  const r = rng(11);
  const nodes: Node[] = [];
  const P = seed.providers.length;
  const providerIdx = new Map<string, number>();

  seed.providers.forEach((p, i) => {
    providerIdx.set(p.slug, nodes.length);
    nodes.push({
      kind: 'provider',
      label: p.name,
      href: `/providers/${p.slug}`,
      parent: -1,
      depth: 1,
      radius: 6.5,
      phase: r() * 6.28,
      at: [],
    });
    void i;
  });
  seed.models.forEach((m) => {
    const parent = providerIdx.get(m.providerSlug);
    if (parent === undefined) return;
    nodes.push({
      kind: 'model',
      label: m.name,
      href: `/models/${m.slug}`,
      parent,
      depth: 0.62,
      radius: 3.4,
      phase: r() * 6.28,
      at: [],
    });
  });
  // Short on data (a young catalogue): add unlabelled decorative nodes so the network stays dense.
  for (let k = 0; P > 0 && nodes.length < cfg.minNodes; k++) {
    nodes.push({
      kind: 'model',
      label: '',
      href: '',
      parent: k % P,
      depth: 0.62,
      radius: 3,
      phase: r() * 6.28,
      at: [],
    });
  }
  for (let i = 0; i < particleCount; i++) {
    nodes.push({
      kind: 'particle',
      label: '',
      href: '',
      parent: -1,
      depth: 0.2 + r() * 0.3,
      radius: 0.9 + r() * 1.4,
      phase: r() * 6.28,
      at: [],
    });
  }

  // Formation positions
  const provs = nodes.map((n, i) => (n.kind === 'provider' ? i : -1)).filter((i) => i >= 0);
  const mods = nodes.map((n, i) => (n.kind === 'model' ? i : -1)).filter((i) => i >= 0);
  const parts = nodes.map((n, i) => (n.kind === 'particle' ? i : -1)).filter((i) => i >= 0);
  const angleOf = (k: number, n: number, rot = 0) =>
    (k / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2 + rot;
  const childrenOf = new Map<number, number[]>();
  mods.forEach((mi) =>
    childrenOf.set(nodes[mi]!.parent, [...(childrenOf.get(nodes[mi]!.parent) ?? []), mi]),
  );
  const set = (i: number, f: number, x: number, y: number) => {
    nodes[i]!.at[f] = { x: clamp(x, -1.25, 1.25), y: clamp(y, -1.15, 1.15) };
  };

  // 0 hero: providers on an ellipse, models orbiting them, particles everywhere
  provs.forEach((pi, k) => {
    const a = angleOf(k, P, (r() - 0.5) * 0.3);
    set(pi, 0, Math.cos(a) * 0.72, Math.sin(a) * 0.64);
  });
  mods.forEach((mi) => {
    const p = nodes[nodes[mi]!.parent]!.at[0]!;
    const a = r() * 6.28;
    const d = 0.13 + r() * 0.16;
    set(mi, 0, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  });
  parts.forEach((pi) => set(pi, 0, (r() - 0.5) * 2.4, (r() - 0.5) * 2.2));

  // 1 stats: a dense core
  provs.forEach((pi, k) => {
    const a = angleOf(k, P);
    set(pi, 1, Math.cos(a) * 0.26, Math.sin(a) * 0.26);
  });
  mods.forEach((mi) => set(mi, 1, gauss(r) * 0.36, gauss(r) * 0.36));
  parts.forEach((pi) => set(pi, 1, gauss(r) * 0.9, gauss(r) * 0.8));

  // 2 featured: a lattice
  const lattice = [...provs, ...mods];
  const cols = Math.max(4, Math.ceil(Math.sqrt(lattice.length * 1.8)));
  lattice.forEach((ni, k) => {
    const c = k % cols;
    const row = Math.floor(k / cols);
    const rows = Math.ceil(lattice.length / cols);
    set(ni, 2, (c / (cols - 1) - 0.5) * 1.7, (row / Math.max(1, rows - 1) - 0.5) * 1.1);
  });
  parts.forEach((pi) => set(pi, 2, 0.15 + (r() - 0.2) * 1.5, (r() - 0.5) * 2.1));

  // 3 providers: a ring with models clustered in front of their provider
  provs.forEach((pi, k) =>
    set(pi, 3, Math.cos(angleOf(k, P)) * 0.66, Math.sin(angleOf(k, P)) * 0.66),
  );
  mods.forEach((mi) => {
    const p = nodes[nodes[mi]!.parent]!.at[3]!;
    const a = Math.atan2(p.y, p.x) + (r() - 0.5) * 0.5;
    const d = 0.28 + r() * 0.16;
    set(mi, 3, Math.cos(a) * d, Math.sin(a) * d);
  });
  parts.forEach((pi) => {
    const a = r() * 6.28;
    const d = 0.95 + r() * 0.35;
    set(pi, 3, Math.cos(a) * d, Math.sin(a) * d * 0.85);
  });

  // 4 compare: two columns facing each other
  provs.forEach((pi, k) => {
    const left = k % 2 === 0;
    const row = Math.floor(k / 2);
    const rows = Math.ceil(P / 2);
    set(pi, 4, left ? -0.78 : 0.78, (row / Math.max(1, rows - 1) - 0.5) * 1.5);
  });
  mods.forEach((mi) => {
    const p = nodes[nodes[mi]!.parent]!.at[4]!;
    set(mi, 4, p.x * 0.42 + (r() - 0.5) * 0.12, p.y + (r() - 0.5) * 0.22);
  });
  parts.forEach((pi) => set(pi, 4, (r() - 0.5) * 0.5, (r() - 0.5) * 2.2));

  // 5 releases: a timeline spine on the right, events alternating around it
  const spine = [...provs, ...mods].sort((a, b) => a - b);
  spine.forEach((ni, k) => {
    const t = k / Math.max(1, spine.length - 1);
    const side = k % 2 === 0 ? -1 : 1;
    set(
      ni,
      5,
      0.3 + side * (nodes[ni]!.kind === 'provider' ? 0.06 : 0.16 + r() * 0.1),
      (t - 0.5) * 2.0,
    );
  });
  parts.forEach((pi) => set(pi, 5, -0.9 + r() * 1.1, (r() - 0.5) * 2.2));

  // 6 news: a spiral galaxy
  const spiral = [...provs, ...mods];
  spiral.forEach((ni, k) => {
    const t = k / Math.max(1, spiral.length);
    const a = t * Math.PI * 5.2;
    const d = 0.08 + t * 0.95;
    set(ni, 6, Math.cos(a) * d, Math.sin(a) * d * 0.8);
  });
  parts.forEach((pi, k) => {
    const t = k / Math.max(1, parts.length);
    const a = t * Math.PI * 6 + 0.6;
    const d = 0.1 + t * 1.15 + (r() - 0.5) * 0.12;
    set(pi, 6, Math.cos(a) * d, Math.sin(a) * d * 0.8);
  });

  // 7 cta: everything converges on the centre, particles form a halo
  [...provs, ...mods].forEach((ni, k, all) => {
    const a = (k / all.length) * Math.PI * 2 * 3;
    const d = 0.05 + (k % 7) * 0.03;
    set(ni, 7, Math.cos(a) * d, Math.sin(a) * d);
  });
  parts.forEach((pi) => {
    const a = r() * 6.28;
    const d = 0.7 + r() * 0.5;
    set(pi, 7, Math.cos(a) * d, Math.sin(a) * d * 0.85);
  });
  return nodes;
}

// ------------------------------------------------------------------------------------ canvas

export function createBackground(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  seed: BackgroundSeed,
  opts: BackgroundOptions,
): Background {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return { status: () => emptyStatus(), measure() {}, destroy() {} };

  // Low-resolution canvas for the glows, directly behind the main one.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.setAttribute('aria-hidden', 'true');
  glowCanvas.dataset.cineGlow = '';
  Object.assign(glowCanvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '-2',
    pointerEvents: 'none',
  });
  canvas.before(glowCanvas);
  const gctx = glowCanvas.getContext('2d', { alpha: true });
  if (!gctx) {
    glowCanvas.remove();
    return { status: () => emptyStatus(), measure() {}, destroy() {} };
  }

  const nodes = buildNodes(seed, opts.mobile ? cfg.particles.mobile : cfg.particles.desktop);
  const nProv = nodes.filter((n) => n.kind === 'provider').length;
  const structural: [number, number][] = [];
  nodes.forEach((n, i) => {
    if (n.kind === 'model') structural.push([n.parent, i]);
  });
  const provIdx = nodes.map((n, i) => (n.kind === 'provider' ? i : -1)).filter((i) => i >= 0);
  provIdx.forEach((p, k) => structural.push([p, provIdx[(k + 1) % provIdx.length]!]));
  const mainNodes = nodes.map((n, i) => (n.kind === 'particle' ? -1 : i)).filter((i) => i >= 0);

  let w = 0;
  let h = 0;
  let dpr = 1;
  let colors = readColors();
  let font = '12px system-ui, sans-serif';
  const pointer = { x: -9999, y: -9999, active: false, hoverOk: false, nx: 0, ny: 0 };
  const heroEl = root.querySelector<HTMLElement>('[data-cine-state="hero"]');
  let hovered = -1;
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  let frames = 0;
  const deltas: number[] = [];
  // Adaptive quality (see backgroundConfig.adaptive)
  let quality = 0;
  let smoothDt = 16.7;
  let slowFor = 0;
  let fastFor = 0;

  // Section map: document-space centres of [data-cine-state] sections, and their formation.
  let centres: number[] = [];
  let states: number[] = [];
  let docH = 1;
  let fReal = 0;
  let fShown = 0;

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      accent: v('--accent'),
      accent2: v('--accent-2'),
      accent3: v('--accent-3'),
      text: v('--text'),
      muted: v('--text-muted'),
      line: v('--text-2'),
      bg: v('--bg-primary'),
      light,
    };
  }

  function resize() {
    dpr = Math.min(
      window.devicePixelRatio || 1,
      opts.mobile ? cfg.maxDpr.mobile : cfg.maxDpr.desktop,
    );
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    glowCanvas.width = Math.max(2, Math.round(w * cfg.glowScale));
    glowCanvas.height = Math.max(2, Math.round(h * cfg.glowScale));
    gctx!.setTransform(cfg.glowScale, 0, 0, cfg.glowScale, 0, 0);
    font = `500 12px ${getComputedStyle(document.body).fontFamily}`;
  }

  function measure() {
    const secs = [...root.querySelectorAll<HTMLElement>('[data-cine-state]')];
    const y = window.scrollY;
    centres = secs.map((s) => {
      const r = s.getBoundingClientRect();
      return r.top + y + r.height / 2;
    });
    states = secs.map(
      (s, i) => FORMATION_INDEX[s.dataset.cineState ?? ''] ?? i % FORMATIONS.length,
    );
    docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function sectionPosition(): number {
    if (centres.length < 2) return 0;
    const y = window.scrollY + h * 0.5;
    if (y <= centres[0]!) return 0;
    for (let i = 0; i < centres.length - 1; i++) {
      if (y < centres[i + 1]!) return i + (y - centres[i]!) / (centres[i + 1]! - centres[i]!);
    }
    return centres.length - 1;
  }

  /** Blended formation values for a fractional section position. */
  function blend(f: number) {
    const a = clamp(Math.floor(f), 0, Math.max(0, states.length - 1));
    const b = Math.min(a + 1, Math.max(0, states.length - 1));
    const u = smooth(clamp(f - a, 0, 1));
    return { fa: states[a] ?? 0, fb: states[b] ?? 0, u };
  }

  const pos = nodes.map(() => ({ x: 0, y: 0, a: 1 }));

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(now - last, 64);
    last = now;
    frames++;
    deltas.push(dt);
    if (deltas.length > 300) deltas.shift();
    {
      const ad = cfg.adaptive;
      smoothDt += (dt - smoothDt) * 0.08;
      if (frames > 45) {
        slowFor = smoothDt > ad.slowMs ? slowFor + dt : 0;
        fastFor = smoothDt < ad.fastMs ? fastFor + dt : 0;
        if (slowFor > ad.degradeAfterMs && quality < ad.maxLevel) {
          quality++;
          slowFor = 0;
        } else if (fastFor > ad.recoverAfterMs && quality > 0) {
          quality--;
          fastFor = 0;
        }
      }
    }

    fReal = sectionPosition();
    fShown += (fReal - fShown) * (1 - Math.exp(-dt / cfg.followMs));
    const { fa, fb, u } = blend(fShown);
    const A = FORMATIONS[fa]!;
    const B = FORMATIONS[fb]!;
    const cam = {
      zoom: lerp(A.cam.zoom, B.cam.zoom, u),
      x: lerp(A.cam.x, B.cam.x, u),
      y: lerp(A.cam.y, B.cam.y, u),
      rot: lerp(A.cam.rot, B.cam.rot, u),
    };
    const t = now - t0;
    const scrollFrac = clamp(window.scrollY / docH, 0, 1);
    const travel = (scrollFrac - 0.5) * cfg.parallaxTravel;
    const reveal = opts.reveal > 0 ? (t / 1000 / opts.reveal) * 1.7 : 9;
    const half = Math.min(w, h) * 0.5;
    const cx = w / 2;
    const cy = h / 2;
    const cos = Math.cos(cam.rot);
    const sin = Math.sin(cam.rot);
    const heroWeight = fShown < 1 ? 1 - smooth(clamp(fShown, 0, 1)) : 0;

    // Pointer smoothing (normalised -1..1 from the centre)
    const pnx = pointer.active ? (pointer.x - cx) / (w / 2) : 0;
    const pny = pointer.active ? (pointer.y - cy) / (h / 2) : 0;
    pointer.nx += (pnx - pointer.nx) * 0.06;
    pointer.ny += (pny - pointer.ny) * 0.06;

    ctx!.clearRect(0, 0, w, h);
    const drawGlow = frames % (cfg.glowEvery * (quality >= 2 ? 2 : 1)) === 0;
    if (drawGlow) gctx!.clearRect(0, 0, w, h);

    // 1. glows (slowest layer), breathing
    const breathe = 1 + Math.sin(t * cfg.breatheSpeed) * cfg.breathe;
    const glowColor = [colors.accent, colors.accent2, colors.accent3];
    const nGlow = Math.max(A.glow.length, B.glow.length);
    for (let g = 0; drawGlow && g < nGlow; g++) {
      const ga = A.glow[g] ?? A.glow[0]!;
      const gb = B.glow[g] ?? B.glow[0]!;
      const gx = lerp(ga.x, gb.x, u);
      const gy = lerp(ga.y, gb.y, u) - travel * cfg.layerSpeed.glow;
      const gr = lerp(ga.r, gb.r, u) * breathe * Math.max(w, h) * 0.55;
      const colA = glowColor[ga.c]!;
      const colB = glowColor[gb.c]!;
      const alpha = lerp(ga.a, gb.a, u) * (colors.light ? 0.55 : 1);
      const px =
        cx + gx * half * 1.5 - pointer.nx * w * cfg.pointerParallax * cfg.layerSpeed.glow * 3;
      const py = cy + gy * half;
      const col = mixColor(colA, colB, u);
      const grad = gctx!.createRadialGradient(px, py, 0, px, py, gr);
      grad.addColorStop(0, withAlpha(col, alpha));
      grad.addColorStop(1, withAlpha(col, 0));
      gctx!.fillStyle = grad;
      gctx!.fillRect(px - gr, py - gr, gr * 2, gr * 2);
    }

    // 2. grid (second slowest), rotating and re-spacing per section
    if (quality < 2) {
      const angle = lerp(A.grid.angle, B.grid.angle, u) + pointer.nx * 0.03;
      const spacing = lerp(A.grid.spacing, B.grid.spacing, u) * half * 2;
      const alpha = lerp(A.grid.alpha, B.grid.alpha, u) * (colors.light ? 0.18 : 0.12);
      const off = -travel * cfg.layerSpeed.grid * half * 2;
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.rotate(angle);
      ctx!.globalAlpha = alpha;
      ctx!.strokeStyle = colors.line;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      const reach = Math.hypot(w, h);
      const startX = -Math.ceil(reach / spacing) * spacing;
      for (let gx = startX; gx <= reach; gx += spacing) {
        ctx!.moveTo(gx, -reach);
        ctx!.lineTo(gx, reach);
      }
      const m = ((off % spacing) + spacing) % spacing;
      for (let gy = -Math.ceil(reach / spacing) * spacing + m; gy <= reach; gy += spacing) {
        ctx!.moveTo(-reach, gy);
        ctx!.lineTo(reach, gy);
      }
      ctx!.stroke();
      ctx!.restore();
    }

    // 3. node positions in screen space
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const pa = n.at[fa]!;
      const pb = n.at[fb]!;
      let x = lerp(pa.x, pb.x, u);
      let y = lerp(pa.y, pb.y, u);
      // idle drift
      x += Math.sin(t * cfg.idleSpeed + n.phase) * cfg.idleDrift * (0.5 + n.depth);
      y += Math.cos(t * cfg.idleSpeed * 0.83 + n.phase * 1.3) * cfg.idleDrift * (0.5 + n.depth);
      // layer parallax by scroll (vertical) and pointer
      const speed =
        n.kind === 'provider'
          ? cfg.layerSpeed.providers
          : n.kind === 'model'
            ? cfg.layerSpeed.models
            : cfg.layerSpeed.particles * (0.6 + n.depth);
      y -= travel * speed;
      x -= pointer.nx * cfg.pointerParallax * speed * 2;
      y -= pointer.ny * cfg.pointerParallax * speed * 2;
      // camera
      x = (x - cam.x) * cam.zoom;
      y = (y - cam.y) * cam.zoom;
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      let sx = cx + rx * half * 1.45;
      let sy = cy + ry * half * 1.2;
      // cursor attraction
      if (pointer.active && n.kind !== 'particle') {
        const ox = pointer.x - sx;
        const oy = pointer.y - sy;
        const d = Math.hypot(ox, oy);
        if (d < cfg.pointerRadius) {
          const k = (1 - d / cfg.pointerRadius) * cfg.pointerPull;
          sx += ox * k;
          sy += oy * k;
        }
      }
      // fade in from the centre outward
      const dist = Math.hypot((sx - cx) / (w / 2), (sy - cy) / (h / 2));
      const p = pos[i]!;
      p.x = sx;
      p.y = sy;
      p.a = smooth(clamp((reveal - dist) / 0.45, 0, 1));
    }

    // 4. hover (hero only)
    let best = -1;
    if (pointer.hoverOk && heroWeight > cfg.interactiveAbove) {
      let bd: number = cfg.hitRadius;
      for (const i of mainNodes) {
        const p = pos[i]!;
        const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
        if (nodes[i]!.label && p.a > 0.6 && d < bd * (nodes[i]!.kind === 'provider' ? 1.3 : 1)) {
          bd = d;
          best = i;
        }
      }
    }
    if (best !== hovered) {
      hovered = best;
      if (heroEl) heroEl.style.cursor = best >= 0 ? 'pointer' : '';
      root.dataset.cineHover = best >= 0 ? nodes[best]!.label : '';
    }
    const hovNeighbours = new Set<number>();
    if (hovered >= 0) {
      structural.forEach(([a, b]) => {
        if (a === hovered) hovNeighbours.add(b);
        if (b === hovered) hovNeighbours.add(a);
      });
    }

    // 5. links: structural (parent/ring) lines, then batched pulses and trails, then proximity links.
    // Many small draw calls with changing state are what costs on a slow CPU, so everything that
    // can share a style is drawn as one path.
    ctx!.lineCap = 'round';
    const linkBoost = lerp(A.links, B.links, u);
    const edgeBase = colors.light ? 0.36 : 0.5;
    const rv = clamp((reveal - 0.5) / 1.0, 0, 1);
    const pulses: number[] = [];
    const trails: number[] = [];
    structural.forEach(([a, b], k) => {
      const pa = pos[a]!;
      const pb = pos[b]!;
      const al = Math.min(pa.a, pb.a);
      if (al < 0.02) return;
      const hot = hovered === a || hovered === b;
      const dim = hovered >= 0 && !hot;
      ctx!.globalAlpha = al * (hot ? 1 : dim ? 0.12 : Math.min(1, edgeBase * linkBoost));
      ctx!.strokeStyle = hot ? colors.accent2 : colors.accent;
      ctx!.lineWidth = hot ? 1.6 : 1;
      ctx!.beginPath();
      ctx!.moveTo(pa.x, pa.y);
      ctx!.lineTo(pb.x, pb.y);
      ctx!.stroke();
      if (dim) return;
      const pt = (t * cfg.pulseSpeed + k * 0.37) % 1;
      const tt = Math.max(0, pt - 0.06);
      pulses.push(pa.x + (pb.x - pa.x) * pt, pa.y + (pb.y - pa.y) * pt);
      trails.push(
        pa.x + (pb.x - pa.x) * tt,
        pa.y + (pb.y - pa.y) * tt,
        pa.x + (pb.x - pa.x) * pt,
        pa.y + (pb.y - pa.y) * pt,
      );
    });
    if (trails.length && quality < 2) {
      ctx!.globalAlpha = 0.42 * rv;
      ctx!.lineWidth = 1.6;
      ctx!.strokeStyle = colors.accent2;
      ctx!.beginPath();
      for (let i = 0; i < trails.length; i += 4) {
        ctx!.moveTo(trails[i]!, trails[i + 1]!);
        ctx!.lineTo(trails[i + 2]!, trails[i + 3]!);
      }
      ctx!.stroke();
      ctx!.globalAlpha = 0.95 * rv;
      ctx!.fillStyle = colors.accent2;
      ctx!.beginPath();
      for (let i = 0; i < pulses.length; i += 2) {
        ctx!.moveTo(pulses[i]! + 1.8, pulses[i + 1]!);
        ctx!.arc(pulses[i]!, pulses[i + 1]!, 1.8, 0, 6.2832);
      }
      ctx!.fill();
    }
    if (!opts.mobile && quality < 1) {
      const thr = cfg.linkDistance * half * 1.45;
      const dimF = hovered >= 0 ? 0.4 : 1;
      const levels: number[][] = [[], [], [], []];
      for (let ii = 0; ii < mainNodes.length; ii++) {
        const a = pos[mainNodes[ii]!]!;
        for (let jj = ii + 1; jj < mainNodes.length; jj++) {
          const b = pos[mainNodes[jj]!]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (dx > thr || dx < -thr || dy > thr || dy < -thr) continue;
          const d = Math.hypot(dx, dy);
          if (d > thr) continue;
          const al = (1 - d / thr) * Math.min(a.a, b.a);
          levels[Math.min(3, Math.floor(al * 4))]!.push(a.x, a.y, b.x, b.y);
        }
      }
      ctx!.lineWidth = 0.7;
      ctx!.strokeStyle = colors.line;
      levels.forEach((segs, lvl) => {
        if (!segs.length) return;
        ctx!.globalAlpha = ((lvl + 0.5) / 4) * 0.28 * linkBoost * dimF;
        ctx!.beginPath();
        for (let i = 0; i < segs.length; i += 4) {
          ctx!.moveTo(segs[i]!, segs[i + 1]!);
          ctx!.lineTo(segs[i + 2]!, segs[i + 3]!);
        }
        ctx!.stroke();
      });
    }

    // 6. particles (batched by colour and brightness), then nodes (far to near)
    {
      const dimP = hovered >= 0 ? 0.5 : 1;
      const groups: number[][] = [[], [], [], [], [], [], [], []]; // 2 colours x 4 brightness levels
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        if (n.kind !== 'particle') continue;
        if (quality >= 1 && i % 2 === 1) continue;
        const p = pos[i]!;
        const al = p.a * (0.35 + 0.35 * Math.sin(t * 0.002 + n.phase)) * dimP;
        const lvl = Math.min(3, Math.floor(al * 5.7));
        groups[(n.depth > 0.4 ? 4 : 0) + lvl]!.push(p.x, p.y, n.radius * (0.7 + n.depth));
      }
      groups.forEach((g, gi) => {
        if (!g.length) return;
        ctx!.globalAlpha = ((gi % 4) + 0.5) / 5.7;
        ctx!.fillStyle = gi >= 4 ? colors.accent2 : colors.muted;
        ctx!.beginPath();
        for (let i = 0; i < g.length; i += 3) {
          ctx!.moveTo(g[i]! + g[i + 2]!, g[i + 1]!);
          ctx!.arc(g[i]!, g[i + 1]!, g[i + 2]!, 0, 6.2832);
        }
        ctx!.fill();
      });
    }
    for (const i of mainNodes) {
      const n = nodes[i]!;
      if (n.kind !== 'model') continue;
      drawNode(i, n, false);
    }
    for (const i of mainNodes) {
      const n = nodes[i]!;
      if (n.kind !== 'provider') continue;
      drawNode(i, n, true);
    }
    function drawNode(i: number, n: Node, big: boolean) {
      const p = pos[i]!;
      const isH = hovered === i;
      const isN = hovNeighbours.has(i);
      const dim = hovered >= 0 && !isH && !isN;
      const r =
        n.radius *
        (isH ? 1.7 : 1) *
        (0.85 + 0.15 * Math.sin(t * 0.0016 + n.phase)) *
        (n.depth > 0.9 ? 1 : 0.95);
      const a = p.a * (dim ? 0.3 : 1);
      if (big || isH) {
        ctx!.globalAlpha = a * 0.45;
        ctx!.drawImage(nodeGlow(), p.x - r * 4.2, p.y - r * 4.2, r * 8.4, r * 8.4);
      }
      ctx!.globalAlpha = a;
      ctx!.fillStyle = big || isH || isN ? colors.accent : colors.text;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, r, 0, 6.2832);
      ctx!.fill();
      if (big) {
        ctx!.globalAlpha = a * 0.9;
        ctx!.lineWidth = 1;
        ctx!.strokeStyle = colors.accent2;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r + 3.5 + Math.sin(t * 0.002 + n.phase) * 1.2, 0, 6.2832);
        ctx!.stroke();
      }
      // labels: providers in the hero, anything near the cursor
      const near =
        pointer.hoverOk &&
        heroWeight > cfg.interactiveAbove &&
        Math.hypot(p.x - pointer.x, p.y - pointer.y) < cfg.labelRadius;
      const showProvider = big && heroWeight > 0.25 && !opts.mobile;
      if ((showProvider || near || isH || isN) && n.label) {
        const la = a * (isH || isN || near ? 1 : heroWeight * 0.85);
        if (la > 0.03) {
          ctx!.globalAlpha = la;
          ctx!.font = isH ? `600 13px ${font.split('px ')[1]}` : font;
          ctx!.fillStyle = colors.text;
          ctx!.textBaseline = 'middle';
          const tx = p.x + (p.x > cx ? 12 : -12);
          ctx!.textAlign = p.x > cx ? 'left' : 'right';
          ctx!.fillText(n.label, tx, p.y - (big ? 10 : 8));
          if (isH) {
            ctx!.globalAlpha = la * 0.75;
            ctx!.fillStyle = colors.accent2;
            ctx!.font = `500 11px ${font.split('px ')[1]}`;
            ctx!.fillText(`${n.kind} · click to open →`, tx, p.y + 8);
          }
        }
      }
    }
    ctx!.globalAlpha = 1;
  }

  function hex(color: string): [number, number, number] {
    const c = color.startsWith('#') && color.length >= 7 ? color : '#5685ff';
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  /** A pre-rendered soft glow (re-made when the theme colours change): drawing it is far cheaper than a gradient per node per frame. */
  let glowSprite: HTMLCanvasElement | null = null;
  let glowSpriteColor = '';
  function nodeGlow(): HTMLCanvasElement {
    if (glowSprite && glowSpriteColor === colors.accent) return glowSprite;
    const c = glowSprite ?? document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 96, 96);
    const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    grad.addColorStop(0, withAlpha(colors.accent, 1));
    grad.addColorStop(1, withAlpha(colors.accent, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    glowSprite = c;
    glowSpriteColor = colors.accent;
    return c;
  }

  /** Cross-fades two #rrggbb colours (the glow colour changes smoothly between sections). */
  function mixColor(a: string, b: string, t: number): string {
    const [ar, ag, ab] = hex(a);
    const [br, bg, bb] = hex(b);
    const m = (x: number, y: number) =>
      Math.round(lerp(x, y, t))
        .toString(16)
        .padStart(2, '0');
    return `#${m(ar, br)}${m(ag, bg)}${m(ab, bb)}`;
  }

  function withAlpha(color: string, alpha: number) {
    // CSS variables here are #rrggbb
    const c = color.startsWith('#') && color.length >= 7 ? color : '#5685ff';
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${clamp(alpha, 0, 1).toFixed(3)})`;
  }

  // ------------------------------------------------------------------------------- events
  const interactive = (el: EventTarget | null) =>
    el instanceof Element &&
    !!el.closest(
      'a,button,input,select,textarea,label,summary,[role="button"],[data-cine-card],nav,header,footer',
    );
  const heroZone = (el: EventTarget | null) =>
    el instanceof Element && !!el.closest('[data-cine-state="hero"]');
  let lastMove = 0;
  const onMove = (e: PointerEvent) => {
    const tt = performance.now();
    if (tt - lastMove < 12) return;
    lastMove = tt;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    // Hover, labels and clicks only count where the hero background is what the pointer is over.
    pointer.hoverOk = heroZone(e.target) && !interactive(e.target);
  };
  const onLeave = () => {
    pointer.active = false;
    pointer.hoverOk = false;
  };
  const onClick = (e: MouseEvent) => {
    if (hovered >= 0 && pointer.hoverOk && heroZone(e.target) && !interactive(e.target)) {
      opts.navigate(nodes[hovered]!.href);
    }
  };
  const onVis = () => {
    last = performance.now();
  };
  const mo = new MutationObserver(() => {
    colors = readColors();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const ro = new ResizeObserver(() => {
    resize();
    measure();
  });
  ro.observe(document.documentElement);
  resize();
  measure();
  fShown = sectionPosition();
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  function emptyStatus(): BackgroundStatus {
    return {
      frames: 0,
      quality: 0,
      f: 0,
      fps: { p50: 0, p95: 0, slowFrames: 0, sampled: 0 },
      nodes: 0,
      particles: 0,
    };
  }

  return {
    measure,
    status() {
      const sorted = [...deltas].sort((a, b) => a - b);
      const q = (p: number) =>
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
      return {
        frames,
        f: fShown,
        fps: {
          p50: Math.round((1000 / (q(0.5) || 16.7)) * 10) / 10,
          p95: Math.round((1000 / (q(0.95) || 16.7)) * 10) / 10,
          slowFrames: deltas.filter((d) => d > 20).length,
          sampled: deltas.length,
        },
        quality,
        nodes: nodes.length - nodes.filter((n) => n.kind === 'particle').length,
        particles: nodes.filter((n) => n.kind === 'particle').length,
      };
    },
    destroy() {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVis);
      glowCanvas.remove();
      if (heroEl) heroEl.style.cursor = '';
      void nProv;
    },
  };
}
