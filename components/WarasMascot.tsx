"use client";

import { useEffect, useRef, useState } from "react";

export type MascotStatus = "idle" | "good" | "warning";

// The file and export names still say "Cat" from the first version of the app; the mascot is now a person in sportswear.
// 16x16 sprites, front view. . = empty, r = hair, b = headband, s = skin, e = eye, t = tank top, p = shorts,
// l = shoes, g = ground, a = state mark (sparkle when good, exclamation when warning).
// Each status has one or more frames; MOTION below decides which frame shows and how far it is nudged.
const SPRITES: Record<MascotStatus, string[][]> = {
  // Standing relaxed. Frame 1 waves the right hand.
  idle: [
    [
    "................",
    "......rrrr......",
    ".....rrrrrr.....",
    ".....bbbbbb.....",
    ".....sesses.....",
    ".....ssssss.....",
    "......ssss......",
    "....stttttts....",
    "....stttttts....",
    "....stttttts....",
    "....spppppps....",
    ".....pppppp.....",
    ".....pp..pp.....",
    ".....ss..ss.....",
    "....lll..lll....",
    "..gggggggggggg..",
  ],
    [
    "................",
    "......rrrr......",
    ".....rrrrrr.....",
    ".....bbbbbb.....",
    ".....sesses..s..",
    ".....ssssss.s...",
    "......ssss.s....",
    "....stttttts....",
    "....stttttt.....",
    "....stttttt.....",
    "....spppppp.....",
    ".....pppppp.....",
    ".....pp..pp.....",
    ".....ss..ss.....",
    "....lll..lll....",
    "..gggggggggggg..",
  ],
  ],
  // Arms up in a V, one clean rep done.
  good: [
    [
    ".a............a.",
    ".s............s.",
    ".s....rrrr....s.",
    "..s..rrrrrr..s..",
    "..s..bbbbbb..s..",
    "...s.sesses.s...",
    "...s.ssssss.s...",
    "....s.ssss.s....",
    "....stttttts....",
    ".....tttttt.....",
    ".....tttttt.....",
    ".....pppppp.....",
    ".....pp..pp.....",
    ".....ss..ss.....",
    "....lll..lll....",
    "..gggggggggggg..",
  ],
  ],
  // Wide, deep squat with an exclamation mark: the last rep needs a fix.
  warning: [
    [
    "..............a.",
    "..............a.",
    "..............a.",
    "................",
    "..............a.",
    "......rrrr......",
    ".....rrrrrr.....",
    ".....bbbbbb.....",
    ".....sesses.....",
    "....ssttttss....",
    "..sssttttttsss..",
    "....pppppppp....",
    "...ppp....ppp...",
    "..ss........ss..",
    ".lll........lll.",
    "..gggggggggggg..",
  ],
  ],
};

// Animation script per status. Every `ms` the mascot moves to the next step: f = frame index,
// x / y = shift in sprite pixels (negative y is up). The ground never moves, only the figure does.
// Why it moves: idle breathes and waves (waiting), good hops (celebrating), warning shakes (alert).
type Step = { f: number; x?: number; y?: number };
const MOTION: Record<MascotStatus, { ms: number; steps: Step[] }> = {
  idle: {
    ms: 450,
    steps: [{ f: 0 }, { f: 0, y: -1 }, { f: 0 }, { f: 0, y: -1 }, { f: 1 }, { f: 1, y: -1 }, { f: 1 }, { f: 1, y: -1 }],
  },
  good: { ms: 300, steps: [{ f: 0 }, { f: 0, y: -1 }] },
  warning: { ms: 220, steps: [{ f: 0 }, { f: 0, x: 1 }, { f: 0 }, { f: 0, x: -1 }] },
};
// Click the mascot: it hops this many sprite pixels up and back down, 110 ms per pose.
const HOP = [-3, -5, -3, 0];
const BLINK_MS = 140; // how long the eyes stay shut
const BLINK_EVERY: [number, number] = [2200, 5000]; // random gap between blinks, in ms

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Skin, hair and eye are fixed colors; top, shorts, shoes and ground follow the theme so the figure reads on light and dark.
const SKIN = "fill-[#E8B48A]";
const ACCENT: Record<MascotStatus, string> = { idle: "fill-mute", good: "fill-accent", warning: "fill-warn" };
const BASE: Record<string, string> = {
  r: "fill-[#6B4423]",
  b: "fill-accent",
  s: SKIN,
  e: "fill-[#1C1917]",
  t: "fill-accent",
  p: "fill-ink",
  l: "fill-mute",
  g: "fill-line",
};
const LABEL: Record<MascotStatus, string> = {
  idle: "Maskot WARAS bersiap di posisi berdiri",
  good: "Maskot WARAS mengangkat tangan: squat benar",
  warning: "Maskot WARAS berjongkok lebar: perbaiki posisi",
};

// Merge horizontal runs of one color into a single rect so the SVG stays small.
function toRects(rows: string[], colors: (c: string) => string) {
  const rects: { x: number; y: number; w: number; cls: string }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let end = x + 1;
      while (row[end] === c) end++;
      if (c !== ".") rects.push({ x, y, w: end - x, cls: colors(c) });
      x = end;
    }
  });
  return rects;
}

export function WarasCatMascot({ status, size = 64 }: { status: MascotStatus; size?: number }) {
  const [tick, setTick] = useState(0);
  const [blink, setBlink] = useState(false);
  const [hop, setHop] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { ms, steps } = MOTION[status];

  // Step through the movement script. Skipped when the person asked their OS for reduced motion.
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);

  // Blink at random gaps: the eye pixels turn skin colored for a moment.
  useEffect(() => {
    if (reducedMotion()) return;
    let t: ReturnType<typeof setTimeout>;
    const wait = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => {
          setBlink(false);
          wait();
        }, BLINK_MS);
      }, BLINK_EVERY[0] + Math.random() * (BLINK_EVERY[1] - BLINK_EVERY[0]));
    };
    wait();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  // A click is the person's own action, so it hops even with reduced motion.
  function poke() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBlink(true);
    HOP.forEach((y, k) =>
      timers.current.push(
        setTimeout(() => {
          setHop(y);
          if (k === HOP.length - 1) setBlink(false);
        }, k * 110),
      ),
    );
  }

  const step = steps[tick % steps.length];
  const frames = SPRITES[status];
  const rows = frames[Math.min(step.f, frames.length - 1)];
  const accent = ACCENT[status];
  const rects = toRects(rows, (c) => (c === "a" ? accent : c === "e" && blink ? SKIN : BASE[c]));
  const ground = rects.filter((r) => r.cls === BASE.g);
  const figure = rects.filter((r) => r.cls !== BASE.g);
  const rect = (r: (typeof rects)[number]) => (
    <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} className={r.cls} />
  );

  return (
    <button
      type="button"
      onClick={poke}
      aria-label={`${LABEL[status]}. Klik untuk mencolek maskot.`}
      title="Colek maskot"
      className="shrink-0 cursor-pointer"
    >
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        style={{ imageRendering: "pixelated" }}
        aria-hidden
        className="block overflow-visible"
      >
        {ground.map(rect)}
        <g transform={`translate(${step.x ?? 0} ${(step.y ?? 0) + hop})`}>{figure.map(rect)}</g>
      </svg>
    </button>
  );
}

// 15x13 flexed arm used as the brand mark: fist and forearm on the right, biceps on the left.
// app/icon.svg is drawn from the same grid. Orange stays the same in both themes because it is the brand color.
const LOGO = [
  "..........aaaa.",
  ".........aadaaa",
  ".........aadaaa",
  ".........aaaaaa",
  "..........aaaa.",
  "....aaaa..aaaa.",
  "...aahhaa.aaaa.",
  "..aahaaaa.aaaa.",
  "..aaaaaaa.aaaa.",
  ".adddddddaaaaa.",
  "aaaaaaaaaaaaaa.",
  "aaaaaaaaaaaaaa.",
  ".dddddddddddd..",
];
const LOGO_COLORS: Record<string, string> = { a: "fill-[#F97316]", d: "fill-[#B8430A]", h: "fill-[#FDBA74]" };

export function WarasLogo({ size = 30 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 15 13"
      width={size}
      height={(size * 13) / 15}
      shapeRendering="crispEdges"
      aria-hidden
      className="shrink-0"
    >
      {toRects(LOGO, (c) => LOGO_COLORS[c]).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} className={r.cls} />
      ))}
    </svg>
  );
}
