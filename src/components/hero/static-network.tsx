import { buildGraph, type GraphSeed } from './graph';

/**
 * Static SVG rendition of the hero network. Rendered on the server for every visitor as the
 * base layer (fast first paint) and shown alone under prefers-reduced-motion.
 */
export function StaticNetwork({ seed, className = '' }: { seed: GraphSeed; className?: string }) {
  const { nodes, edges } = buildGraph(seed);
  const W = 1000;
  const H = 640;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <g stroke="var(--border-strong)" strokeWidth="1">
        {edges.map((e, i) => {
          const a = nodes[e.a]!;
          const b = nodes[e.b]!;
          return <line key={i} x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H} />;
        })}
      </g>
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={n.x * W}
          cy={n.y * H}
          r={n.radius * 1.4}
          fill={n.kind === 'provider' ? 'var(--accent)' : 'var(--text-muted)'}
          opacity={n.kind === 'provider' ? 0.9 : 0.7}
        />
      ))}
    </svg>
  );
}
