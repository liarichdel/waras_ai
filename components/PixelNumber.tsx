// Big numbers drawn as 3x5 pixel glyphs, in the same pixel grid as the mascot. Color comes from the parent's text color.
// Only the characters the app shows are drawn: digits, "-" (no value yet) and "°".
const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "-": ["000", "000", "111", "000", "000"],
  "°": ["111", "101", "111", "000", "000"],
};

// `unit` is the size of one pixel in screen pixels. Keep it a whole number so the edges stay sharp.
export function PixelNumber({ value, unit = 7 }: { value: string; unit?: number }) {
  const chars = [...value].filter((c) => GLYPHS[c]);
  const rects: { x: number; y: number; w: number }[] = [];
  chars.forEach((c, i) => {
    GLYPHS[c].forEach((row, y) => {
      for (let x = 0; x < 3; ) {
        if (row[x] !== "1") {
          x++;
          continue;
        }
        let end = x + 1;
        while (row[end] === "1") end++;
        rects.push({ x: i * 4 + x, y, w: end - x });
        x = end;
      }
    });
  });
  const cols = Math.max(1, chars.length * 4 - 1);
  return (
    <svg
      viewBox={`0 0 ${cols} 5`}
      width={cols * unit}
      height={5 * unit}
      shapeRendering="crispEdges"
      fill="currentColor"
      role="img"
      aria-label={value}
      className="block"
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  );
}
