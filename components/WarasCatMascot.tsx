export type MascotStatus = "idle" | "good" | "warning";

// The file and export names still say "Cat" from the first version of the app; the mascot is now a person in sportswear.
// 16x16 sprites, front view. . = empty, r = hair, b = headband, s = skin, e = eye, t = tank top, p = shorts,
// l = shoes, g = ground, a = state mark (sparkle when good, exclamation when warning).
const SPRITES: Record<MascotStatus, string[]> = {
  // Standing relaxed, waiting for the first rep.
  idle: [
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
  // Arms up in a V, one clean rep done.
  good: [
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
  // Wide, deep squat with an exclamation mark: the last rep needs a fix.
  warning: [
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
};

// Skin, hair and eye are fixed colors; top, shorts, shoes and ground follow the theme so the figure reads on light and dark.
const ACCENT: Record<MascotStatus, string> = { idle: "fill-mute", good: "fill-accent", warning: "fill-warn" };
const BASE: Record<string, string> = {
  r: "fill-[#6B4423]",
  b: "fill-accent",
  s: "fill-[#E8B48A]",
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
  const accent = ACCENT[status];
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated" }}
      role="img"
      aria-label={LABEL[status]}
      className="shrink-0"
    >
      {toRects(SPRITES[status], (c) => (c === "a" ? accent : BASE[c])).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} className={r.cls} />
      ))}
    </svg>
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
