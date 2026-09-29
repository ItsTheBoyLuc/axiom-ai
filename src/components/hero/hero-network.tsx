'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildGraph, type GraphNode, type GraphSeed } from './graph';

/** Tunables for the network. Kept together so they are easy to adjust. */
export const networkConfig = {
  maxDpr: 1.75, // cap device pixel ratio for performance
  driftSpeed: 0.00006, // normalised units per ms (slow ambient drift)
  driftRadius: 0.018, // how far a node wanders from its home position
  pointerRadius: 170, // px within which nodes are attracted to the pointer
  pointerPull: 0.05, // fraction of the offset applied (attraction strength)
  parallax: 14, // px of whole-graph parallax at the viewport edge
  pulseSpeed: 0.00028, // edge progress per ms
  hitRadius: 16, // px for hover / click hit-testing
};

type Tip = { node: GraphNode; x: number; y: number } | null;

/**
 * Canvas 2D provider/model network. Only mounted client-side (next/dynamic) and only when
 * reduced motion is off. Pauses when off-screen or tab hidden. Purely presentational:
 * links are also exposed as a real list in the hero for keyboard/screen-reader users.
 */
export default function HeroNetwork({ seed }: { seed: GraphSeed }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const graph = useMemo(() => buildGraph(seed), [seed]);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const cfg = networkConfig;
    const { nodes, edges } = graph;
    const phase = nodes.map((_, i) => i * 1.7);
    const pos = nodes.map((n) => ({ x: n.x, y: n.y }));
    const pulses = edges.map((_, i) => ({ t: (i * 0.37) % 1 }));
    const neighbours = nodes.map(() => new Set<number>());
    edges.forEach((e) => {
      neighbours[e.a]!.add(e.b);
      neighbours[e.b]!.add(e.a);
    });

    let w = 0;
    let h = 0;
    let dpr = 1;
    const pointer = { x: -9999, y: -9999, active: false };
    let hovered = -1;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let colors = readColors();

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      return {
        accent: v('--accent'),
        accent2: v('--accent-2'),
        line: v('--border-strong'),
        muted: v('--text-muted'),
        text: v('--text'),
      };
    }

    function resize() {
      const r = box!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, cfg.maxDpr);
      w = r.width;
      h = r.height;
      el!.width = Math.round(w * dpr);
      el!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function screenPos(i: number, now: number) {
      const n = nodes[i]!;
      const p = pos[i]!;
      const ph = phase[i]!;
      const dx = Math.sin(now * cfg.driftSpeed * 9 + ph) * cfg.driftRadius;
      const dy = Math.cos(now * cfg.driftSpeed * 7 + ph * 1.3) * cfg.driftRadius;
      let x = (p.x + dx) * w;
      let y = (p.y + dy) * h;
      // Whole-graph parallax opposite to the pointer
      if (pointer.active) {
        x -= (pointer.x / w - 0.5) * cfg.parallax;
        y -= (pointer.y / h - 0.5) * cfg.parallax;
        // Attraction toward the pointer
        const ox = pointer.x - x;
        const oy = pointer.y - y;
        const d = Math.hypot(ox, oy);
        if (d < cfg.pointerRadius) {
          const k = (1 - d / cfg.pointerRadius) * cfg.pointerPull;
          x += ox * k;
          y += oy * k;
        }
      }
      void n;
      return { x, y };
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const dt = Math.min(now - last, 50);
      last = now;
      ctx!.clearRect(0, 0, w, h);
      const sp = nodes.map((_, i) => screenPos(i, now));

      // Edges
      edges.forEach((e, i) => {
        const a = sp[e.a]!;
        const b = sp[e.b]!;
        const hot = hovered === e.a || hovered === e.b;
        const dim = hovered >= 0 && !hot;
        ctx!.globalAlpha = dim ? 0.25 : hot ? 1 : 0.7;
        ctx!.strokeStyle = hot ? colors.accent : colors.line;
        ctx!.lineWidth = hot ? 1.4 : 1;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();

        // Pulse travelling along the edge
        const pl = pulses[i]!;
        pl.t = (pl.t + dt * cfg.pulseSpeed) % 1;
        const px = a.x + (b.x - a.x) * pl.t;
        const py = a.y + (b.y - a.y) * pl.t;
        ctx!.globalAlpha = dim ? 0.15 : 0.9;
        ctx!.fillStyle = colors.accent2;
        ctx!.beginPath();
        ctx!.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx!.fill();
      });

      // Nodes
      nodes.forEach((n, i) => {
        const p = sp[i]!;
        const isH = hovered === i;
        const isN = hovered >= 0 && neighbours[hovered]!.has(i);
        const dim = hovered >= 0 && !isH && !isN;
        ctx!.globalAlpha = dim ? 0.3 : 1;
        const r = n.radius * (isH ? 1.6 : 1);
        if (n.kind === 'provider' || isH) {
          ctx!.fillStyle = colors.accent;
          ctx!.globalAlpha *= 0.18;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalAlpha = dim ? 0.3 : 1;
        }
        ctx!.fillStyle = n.kind === 'provider' || isH || isN ? colors.accent : colors.muted;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx!.fill();
      });
      ctx!.globalAlpha = 1;

      // Hover hit-test (nearest node)
      let best = -1;
      let bestD: number = cfg.hitRadius;
      if (pointer.active) {
        sp.forEach((p, i) => {
          const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
      }
      if (best !== hovered) {
        hovered = best;
        el!.style.cursor = best >= 0 ? 'pointer' : 'default';
        setTip(best >= 0 ? { node: nodes[best]!, x: sp[best]!.x, y: sp[best]!.y } : null);
      }
    }

    // Pointer handling, throttled to ~one update per frame
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      const t = performance.now();
      if (t - lastMove < 16) return;
      lastMove = t;
      const r = box.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onClick = () => {
      if (hovered >= 0) router.push(nodes[hovered]!.href);
    };

    // Pause off-screen and when the tab is hidden
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting && !document.hidden;
    });
    io.observe(box);
    const onVis = () => {
      visible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);

    // Re-read colors when the theme changes
    const mo = new MutationObserver(() => {
      colors = readColors();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();
    window.addEventListener('pointermove', onMove, { passive: true });
    box.addEventListener('pointerleave', onLeave);
    el.addEventListener('click', onClick);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      mo.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick);
    };
  }, [graph, router]);

  return (
    <div ref={wrap} className="absolute inset-0">
      <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />
      {tip && (
        <div
          role="presentation"
          className="border-line-strong bg-elevated pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border px-3 py-2 text-xs whitespace-nowrap shadow-[var(--shadow-pop)]"
          style={{ left: tip.x, top: tip.y }}
        >
          <span className="text-fg font-medium">{tip.node.label}</span>
          <span className="text-warn ml-2 font-mono text-[10px] tracking-wider uppercase">
            demo
          </span>
          <span className="text-muted block capitalize">
            {tip.node.kind} &middot; click to open
          </span>
        </div>
      )}
    </div>
  );
}
