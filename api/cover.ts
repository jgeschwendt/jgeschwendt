// api/cover.ts — Vercel edge function
// Transparent gold-firefly field. Three layers back-to-front: sharp far
// stars, crisp fireflies drifting along a rising diagonal band, and a
// couple of out-of-focus bokeh orbs pinned to the edges. Every request:
// new constellation. Every mote: own path, period, phase, and breath.
// SMIL only — rendered through GitHub camo as a bare <img>.

export const config = { runtime: "edge" };

const W = 1600;
const H = 280;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const n1 = (v: number) => v.toFixed(1);
const n2 = (v: number) => v.toFixed(2);

// Box–Muller, clipped to ±2σ so a cluster still reads as a cluster.
const gauss = (mu: number, sigma: number) => {
  const u = Math.max(Math.random(), 1e-9);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  return mu + sigma * clamp(z, -2, 2);
};

const GOLDS = ["#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706"];
const PALE = GOLDS.slice(0, 2); // far field — flat fills, no gradient
const MID = GOLDS.slice(0, 3); // fireflies — halo + core edge
const DEEP = GOLDS.slice(3); // near bokeh — the only soft thing here

// Smooth spline segments for n keyframe intervals
const splines = (n: number) => Array(n).fill("0.42 0 0.58 1").join("; ");
const keyTimes = (n: number) =>
  Array.from({ length: n + 1 }, (_, i) => (i / n).toFixed(3)).join("; ");

// Every animation starts mid-flight: a negative begin inside its own period.
const phase = (dur: number) => `-${n1(rand(0, dur))}s`;

// Closed wander loop: 0,0 -> 3 random waypoints -> 0,0. Vertical travel is
// damped to 0.7 so the 1600x280 letterbox never feels vertically crowded.
const wanderPath = (mag: number) =>
  [
    "0 0",
    ...Array.from(
      { length: 3 },
      () => `${n1(rand(-mag, mag))} ${n1(rand(-mag * 0.7, mag * 0.7))}`,
    ),
    "0 0",
  ].join("; ");

const drift = (mag: number, dur: number) =>
  `<animateTransform attributeName="transform" type="translate" values="${wanderPath(mag)}" dur="${n1(dur)}s" begin="${phase(dur)}" repeatCount="indefinite" calcMode="spline" keySplines="${splines(4)}" keyTimes="${keyTimes(4)}"/>`;

// Three-stop there-and-back on any attribute, on its own phase.
const pulse = (attr: string, from: string, to: string, dur: number) =>
  `<animate attributeName="${attr}" values="${from}; ${to}; ${from}" dur="${n1(dur)}s" begin="${phase(dur)}" repeatCount="indefinite" calcMode="spline" keySplines="${splines(2)}" keyTimes="${keyTimes(2)}"/>`;

export default function handler(req: Request): Response {
  // ─── far field ────────────────────────────────────────────────────────────
  // Tiny flat-filled sparks, uniform across the canvas. No gradient, no
  // blur — these carry the sharpness of the whole piece.
  const stars = Array.from({ length: Math.floor(rand(18, 27)) }, () => {
    const r = rand(0.8, 2.2);
    const base = rand(0.2, 0.5);
    const m = r + 4; // wander is ±4px; stay clear of the edges
    return `<circle cx="${n1(rand(m, W - m))}" cy="${n1(rand(m, H - m))}" r="${n1(r)}" fill="${pick(PALE)}" opacity="${n2(base)}">
    ${pulse("opacity", n2(base), n2(base * 0.35), rand(4, 9))}
    ${drift(4, rand(30, 45))}
  </circle>`;
  }).join("\n  ");

  // ─── mid field ────────────────────────────────────────────────────────────
  // The subject. Fireflies ride a band that climbs left-to-right, gathered
  // into 2–3 clusters so the frame keeps rhythm and negative space.
  const bandY = (x: number) => 205 + (75 - 205) * ((x - 60) / (1540 - 60));
  // Always three clusters: two can leave a dead middle at this aspect ratio.
  const clusterCount = 3;
  const clusters = Array.from(
    { length: clusterCount },
    (_, i) => 60 + ((i + rand(0.25, 0.75)) / clusterCount) * (1540 - 60),
  );

  const fireflies = Array.from({ length: Math.floor(rand(11, 15)) }, (_, i) => {
    const r = rand(3, 7);
    const halo = r * 3;
    const mag = rand(18, 40);
    const g = Math.floor(Math.random() * MID.length);

    // Halo radius plus wander reach is the keep-out margin on both axes.
    const mx = halo + mag;
    const my = halo + mag * 0.7;
    const cx = clamp(gauss(clusters[i % clusterCount]!, 90), mx, W - mx);
    const cy = clamp(bandY(cx) + rand(-55, 55), my, H - my);

    const haloOpacity = rand(0.55, 0.9);
    return `<g>
    ${drift(mag, rand(14, 26))}
    <circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(halo)}" fill="url(#halo${g})" opacity="${n2(haloOpacity)}">
      ${pulse("opacity", n2(haloOpacity), n2(haloOpacity * rand(0.45, 0.65)), rand(4, 8))}
    </circle>
    <circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="url(#core${g})">
      ${pulse("r", n1(r), n1(r * rand(1.1, 1.15)), rand(3, 6))}
    </circle>
  </g>`;
  }).join("\n  ");

  // ─── near bokeh ───────────────────────────────────────────────────────────
  // Two or three fat, dim, deliberately out-of-focus orbs, biased to the
  // left and right margins so the middle of the banner stays legible.
  const bokeh = Array.from({ length: Math.floor(rand(2, 4)) }, (_, i) => {
    const r = rand(16, 26);
    const mag = rand(50, 70);
    const mx = r + mag;
    const my = r + mag * 0.7;
    const left = i % 2 === 0;
    const cx = left ? rand(mx, 300) : rand(1300, W - mx);
    return `<circle cx="${n1(cx)}" cy="${n1(rand(my, H - my))}" r="${n1(r)}" fill="url(#bok${i % DEEP.length})" opacity="${n2(rand(0.12, 0.22))}">
    ${drift(mag, rand(22, 34))}
  </circle>`;
  }).join("\n  ");

  // Halos fade to nothing; cores hold full opacity to the last stop so the
  // firefly keeps a defined edge instead of dissolving into its own glow.
  const gradients = [
    ...MID.map(
      (c, i) => `<radialGradient id="halo${i}">
    <stop offset="0%" stop-color="${c}" stop-opacity="0.8"/>
    <stop offset="55%" stop-color="${c}" stop-opacity="0.25"/>
    <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
  </radialGradient>`,
    ),
    ...MID.map(
      (c, i) => `<radialGradient id="core${i}">
    <stop offset="0%" stop-color="#fffbeb"/>
    <stop offset="100%" stop-color="${c}"/>
  </radialGradient>`,
    ),
    ...DEEP.map(
      (c, i) => `<radialGradient id="bok${i}">
    <stop offset="0%" stop-color="${c}" stop-opacity="0.85"/>
    <stop offset="45%" stop-color="${c}" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
  </radialGradient>`,
    ),
  ].join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
  ${gradients}
  </defs>
  ${stars}
  ${fireflies}
  ${bokeh}
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache, no-store, private, must-revalidate, max-age=0",
      "Expires": "0",
      "Pragma": "no-cache",
      "ETag": `"${crypto.randomUUID()}"`,
    },
  });
}
