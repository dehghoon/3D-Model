"use client";
import type { FrameLayout, FrameBrace } from "../lib/simple-frame";
export default function FrameBraceControls({
  layout,
  onChange,
}: {
  layout: FrameLayout;
  onChange: (layout: FrameLayout) => void;
}) {
  const braces = layout.braces ?? [];
  function count(direction: "x" | "y", n: number) {
    if (!Number.isInteger(n) || n < 0 || n > 20) return;
    const old = braces.filter((b) => b.direction === direction);
    const next = old.slice(0, n);
    const cross = layout[direction === "x" ? "y" : "x"].length;
    for (let i = next.length; i < n; i++) {
      let candidate: FrameBrace | undefined;
      for (let from = 0; from < layout[direction].length && !candidate; from++)
        for (let frame = 0; frame <= cross && !candidate; frame++) {
          if (
            !next.some(
              (b) => b.frame === frame && b.from <= from && b.to >= from + 1,
            )
          )
            candidate = {
              id: `${direction}-${i + 1}`,
              direction,
              frame,
              from,
              to: from + 1,
              storey: -1,
              pattern: "/",
            };
        }
      if (!candidate) return;
      next.push(candidate);
    }
    onChange({
      ...layout,
      braces: [...braces.filter((b) => b.direction !== direction), ...next],
    });
  }
  function change(id: string, patch: Partial<FrameBrace>) {
    onChange({
      ...layout,
      braces: braces.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  }
  return (
    <section className="sfBraceControls" aria-label="Bracing setup">
      <h2>Braced bays</h2>
      {(["x", "y"] as const).map((direction) => (
        <div key={direction}>
          <label>
            Number of braced bays {direction.toUpperCase()}
            <input
              aria-label={`Braced bays ${direction.toUpperCase()}`}
              type="number"
              min="0"
              max={Math.min(
                20,
                layout[direction].length *
                  (layout[direction === "x" ? "y" : "x"].length + 1),
              )}
              value={braces.filter((b) => b.direction === direction).length}
              onChange={(e) => count(direction, Number(e.target.value))}
            />
          </label>
          {braces
            .filter((b) => b.direction === direction)
            .map((b, index) => {
              const spans = layout[direction].length;
              const cross = layout[direction === "x" ? "y" : "x"].length;
              const alongLabel = (i: number) =>
                direction === "x" ? String(i + 1) : String.fromCharCode(65 + i);
              const frameLabel = (i: number) =>
                direction === "x" ? String.fromCharCode(65 + i) : String(i + 1);
              return (
                <fieldset key={b.id}>
                  <legend>
                    {direction.toUpperCase()} brace bay {index + 1}
                  </legend>
                  <label>
                    On grid
                    <select
                      aria-label={`${b.id} frame grid`}
                      value={b.frame}
                      onChange={(e) =>
                        change(b.id, { frame: Number(e.target.value) })
                      }
                    >
                      {Array.from({ length: cross + 1 }, (_, i) => (
                        <option key={i} value={i}>
                          {frameLabel(i)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Between grids
                    <select
                      aria-label={`${b.id} from grid`}
                      value={b.from}
                      onChange={(e) => {
                        const from = Number(e.target.value);
                        change(b.id, { from, to: Math.max(from + 1, b.to) });
                      }}
                    >
                      {Array.from({ length: spans }, (_, i) => (
                        <option key={i} value={i}>
                          {alongLabel(i)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    And grid
                    <select
                      aria-label={`${b.id} to grid`}
                      value={b.to}
                      onChange={(e) =>
                        change(b.id, { to: Number(e.target.value) })
                      }
                    >
                      {Array.from({ length: spans }, (_, i) => i + 1)
                        .filter((i) => i > b.from)
                        .map((i) => (
                          <option key={i} value={i}>
                            {alongLabel(i)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Storeys
                    <select
                      aria-label={`${b.id} storeys`}
                      value={b.storey}
                      onChange={(e) =>
                        change(b.id, { storey: Number(e.target.value) })
                      }
                    >
                      <option value={-1}>All storeys</option>
                      {layout.heights.map((_, k) => (
                        <option key={k} value={k}>
                          Storey {k + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pattern
                    <select
                      aria-label={`${b.id} pattern`}
                      value={b.pattern}
                      onChange={(e) =>
                        change(b.id, {
                          pattern: e.target.value as FrameBrace["pattern"],
                        })
                      }
                    >
                      <option value="/">/</option>
                      <option value="\">\</option>
                      <option value="X">X</option>
                    </select>
                  </label>
                </fieldset>
              );
            })}
        </div>
      ))}
      {braces.length && !layout.defaults?.brace ? (
        <p role="status">
          Brace locations saved. Select a complete brace section above to
          generate these members.
        </p>
      ) : null}
      <small>
        Each braced bay applies to its selected storeys. X creates two diagonal
        members per storey.
      </small>
    </section>
  );
}
