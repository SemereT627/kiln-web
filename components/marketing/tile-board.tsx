import { cn } from "@/lib/utils";

/**
 * A showroom sample board: real tile formats (60×60, 30×60, 40×40) laid
 * on a grout grid, a few carrying stock tags the way a shop labels its
 * samples. Pure CSS — tile colours are physical objects, so they
 * stay the same in light and dark mode; only the grout follows the theme.
 *
 * Grid unit = 10 cm, so a 60×60 tile spans 6×6 and a 30×60 spans 3×6.
 */

type Finish = "matt" | "glazed" | "polished";

interface Tile {
  col: number;
  row: number;
  w: number;
  h: number;
  color: string;
  finish: Finish;
  tag?: { code: string; size: string; finish: string; stock: string };
}

// Physical glaze/body colours — fixed hex, not theme tokens.
const C = {
  ivory: "#E6E1D7",
  stone: "#B7AFA3",
  sand: "#D3BD9B",
  charcoal: "#3A3734",
  slate: "#676C6E",
  celadon: "#6F958E",
  clay: "#B5562F",
};

const TILES: Tile[] = [
  { col: 1, row: 1, w: 6, h: 6, color: C.ivory, finish: "polished",
    tag: { code: "G606P112", size: "60×60", finish: "Polished", stock: "214.56 m²" } },
  { col: 7, row: 1, w: 3, h: 6, color: C.charcoal, finish: "matt" },
  { col: 10, row: 1, w: 3, h: 6, color: C.stone, finish: "matt" },
  { col: 1, row: 7, w: 4, h: 4, color: C.celadon, finish: "glazed",
    tag: { code: "D404G031", size: "40×40", finish: "Glazed", stock: "38.40 m²" } },
  { col: 5, row: 7, w: 4, h: 4, color: C.sand, finish: "matt" },
  { col: 9, row: 7, w: 4, h: 4, color: C.clay, finish: "glazed" },
  { col: 1, row: 11, w: 6, h: 3, color: C.slate, finish: "matt" },
  { col: 7, row: 11, w: 6, h: 3, color: C.ivory, finish: "matt",
    tag: { code: "A306M803", size: "30×60", finish: "Matt", stock: "72.00 m²" } },
];

function surface(color: string, finish: Finish): React.CSSProperties {
  // Glazed/polished faces catch a diagonal highlight; matt faces get a soft
  // body variation instead of a shine.
  const sheen =
    finish === "matt"
      ? "linear-gradient(160deg, rgb(255 255 255 / 0.06), transparent 60%)"
      : finish === "glazed"
        ? "linear-gradient(135deg, rgb(255 255 255 / 0.28) 0%, rgb(255 255 255 / 0.05) 38%, transparent 55%)"
        : "linear-gradient(125deg, rgb(255 255 255 / 0.55) 0%, rgb(255 255 255 / 0.08) 30%, transparent 48%, rgb(255 255 255 / 0.12) 80%)";
  return { backgroundColor: color, backgroundImage: sheen };
}

export function TileBoard({
  className,
  showTags = true,
}: {
  className?: string;
  showTags?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label="Sample board of ceramic tiles in 60×60, 30×60 and 40×40 formats, three of them tagged with product code and stock in square metres"
      className={cn(
        "grid aspect-[12/13] grid-cols-12 grid-rows-[repeat(13,minmax(0,1fr))] gap-[3px] rounded-[6px] bg-(--m-grout) p-[3px] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)]",
        className,
      )}
    >
      {TILES.map((t, i) => (
        <div
          key={i}
          className="tile-set relative rounded-[2px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
          style={{
            gridColumn: `${t.col} / span ${t.w}`,
            gridRow: `${t.row} / span ${t.h}`,
            animationDelay: `${i * 70}ms`,
            ...surface(t.color, t.finish),
          }}
        >
          {showTags && t.tag && (
            <div className="tag-hang absolute top-3 left-3 w-max rounded-[3px] bg-[#FBFAF7] px-2.5 py-2 text-[#24211E] shadow-[0_6px_14px_-6px_rgb(0_0_0/0.5)]">
              <p className="font-mono text-[11px] font-medium leading-none">
                {t.tag.code}
              </p>
              <p className="mt-1.5 text-[11px] leading-none text-[#6B655E]">
                {t.tag.size} {t.tag.finish}
              </p>
              <p className="mt-2 text-[13px] font-semibold leading-none tabular-nums">
                {t.tag.stock}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
