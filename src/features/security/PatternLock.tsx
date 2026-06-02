import { useEffect, useMemo, useRef, useState } from "react";

type Dot = { idx: number; x: number; y: number };

function within(a: { x: number; y: number }, b: { x: number; y: number }, r: number) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= r * r;
}

function normalizePattern(seq: number[]) {
  return seq.join("-");
}

export function PatternLock(props: {
  title: string;
  subtitle?: string;
  onComplete: (pattern: string) => void;
  disabled?: boolean;
}) {
  const size = 300;
  const padding = 32;
  const gap = (size - padding * 2) / 2;
  const radius = 18;
  const hitRadius = 28;

  const dots = useMemo<Dot[]>(() => {
    const out: Dot[] = [];
    let k = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        out.push({
          idx: k++,
          x: padding + col * gap,
          y: padding + row * gap,
        });
      }
    }
    return out;
  }, [gap, padding]);

  const ref = useRef<SVGSVGElement | null>(null);
  const [down, setDown] = useState(false);
  const [seq, setSeq] = useState<number[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  function pointFromEvent(e: PointerEvent | React.PointerEvent) {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function maybeAdd(p: { x: number; y: number }) {
    const found = dots.find((d) => within(p, d, hitRadius));
    if (!found) return;
    setSeq((prev) => (prev.includes(found.idx) ? prev : [...prev, found.idx]));
  }

  function reset() {
    setDown(false);
    setSeq([]);
    setCursor(null);
  }

  useEffect(() => {
    function onUp() {
      if (!down) return;
      const pattern = normalizePattern(seq);
      if (seq.length > 0) props.onComplete(pattern);
      reset();
    }
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [down, seq]);

  const lines = useMemo(() => {
    const pts = seq.map((i) => dots[i]!);
    return pts;
  }, [dots, seq]);

  return (
    <div className="grid place-items-center">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-base font-semibold tracking-tight">{props.title}</div>
        {props.subtitle ? (
          <div className="mt-1 text-xs text-zinc-500">{props.subtitle}</div>
        ) : null}

        <div className="mt-4 grid place-items-center">
          <svg
            ref={ref}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className={[
              "touch-none select-none rounded-3xl bg-zinc-50",
              props.disabled ? "opacity-60" : "",
            ].join(" ")}
            onPointerDown={(e) => {
              if (props.disabled) return;
              const p = pointFromEvent(e);
              if (!p) return;
              setDown(true);
              setCursor(p);
              setSeq([]);
              maybeAdd(p);
            }}
            onPointerMove={(e) => {
              if (props.disabled) return;
              if (!down) return;
              const p = pointFromEvent(e);
              if (!p) return;
              setCursor(p);
              maybeAdd(p);
            }}
          >
            {/* lines */}
            {lines.map((p, i) => {
              if (i === 0) return null;
              const a = lines[i - 1]!;
              const b = p;
              return (
                <line
                  key={`${a.idx}-${b.idx}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgb(24 24 27)"
                  strokeWidth={6}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              );
            })}
            {down && cursor && lines.length > 0 ? (
              <line
                x1={lines[lines.length - 1]!.x}
                y1={lines[lines.length - 1]!.y}
                x2={cursor.x}
                y2={cursor.y}
                stroke="rgb(24 24 27)"
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.35}
              />
            ) : null}

            {/* dots */}
            {dots.map((d) => {
              const active = seq.includes(d.idx);
              return (
                <g key={d.idx}>
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={hitRadius}
                    fill="transparent"
                  />
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={radius}
                    fill={active ? "rgb(24 24 27)" : "white"}
                    stroke="rgb(24 24 27)"
                    strokeWidth={2}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-3 text-center text-xs text-zinc-500">
          Connect at least 4 dots.
        </div>
      </div>
    </div>
  );
}

