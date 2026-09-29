import { demoModels, demoProviders } from '@/lib/demo-data';

export type GraphNode = {
  id: string;
  label: string;
  kind: 'provider' | 'model';
  href: string;
  /** Normalised layout position, 0..1 */
  x: number;
  y: number;
  radius: number;
};
export type GraphEdge = { a: number; b: number };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Small seeded PRNG (mulberry32) so server, static fallback and canvas agree on the layout. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Providers sit on an ellipse; each model orbits its provider. Extra provider-to-provider
 * edges make it read as a network. All labels come from demo data (flagged in the UI).
 */
export function buildGraph(): Graph {
  const rand = rng(7);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const n = demoProviders.length;

  demoProviders.forEach((p, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2 + (rand() - 0.5) * 0.35;
    nodes.push({
      id: p.slug,
      label: p.name,
      kind: 'provider',
      href: '/providers',
      x: 0.5 + Math.cos(ang) * 0.34,
      y: 0.5 + Math.sin(ang) * 0.32,
      radius: 6,
    });
  });

  demoModels.forEach((m) => {
    const pi = nodes.findIndex((nd) => nd.id === m.providerSlug);
    const parent = nodes[pi];
    if (!parent) return;
    const ang = rand() * Math.PI * 2;
    const dist = 0.07 + rand() * 0.07;
    nodes.push({
      id: m.slug,
      label: m.name,
      kind: 'model',
      href: '/models',
      x: Math.min(0.96, Math.max(0.04, parent.x + Math.cos(ang) * dist)),
      y: Math.min(0.94, Math.max(0.06, parent.y + Math.sin(ang) * dist)),
      radius: 3.2,
    });
    edges.push({ a: pi, b: nodes.length - 1 });
  });

  for (let i = 0; i < n; i++) edges.push({ a: i, b: (i + 1) % n });
  edges.push({ a: 0, b: 3 }, { a: 1, b: 4 });
  return { nodes, edges };
}
