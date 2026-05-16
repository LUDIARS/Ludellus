import { useState, useRef, useEffect, useCallback } from "react";

const GRAVITY = 0.35;
const BOUNCE = 0.6;
const FRICTION = 0.98;
const LOGO_R = 22;
const LAUNCH_SPEED_MIN = 12;
const LAUNCH_SPEED_MAX = 18;
const CLAUDE_ORANGE = "#E8734A";
const BG = "#1a1a1a";

const BAR_COUNT = 11;
const BASE_BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
  const lengths = [0.95, 0.78, 1.0, 0.72, 0.88, 0.65, 0.92, 0.7, 0.85, 0.75, 0.82];
  return { angle, baseLen: lengths[i] };
});

function ClaudeStarburst({ x, y, r, pressed, barScales, color }) {
  const barW = r * 0.19;
  const c = color || CLAUDE_ORANGE;
  return (
    <g transform={`translate(${x},${y})`}>
      {pressed && <circle r={r * 2.2} fill={c} opacity={0.25} />}
      {BASE_BARS.map((bar, i) => {
        const scale = barScales ? barScales[i] : 1;
        const len = r * 0.88 * bar.baseLen * scale;
        return (
          <line key={i} x1={0} y1={0}
            x2={Math.cos(bar.angle) * len} y2={Math.sin(bar.angle) * len}
            stroke={c} strokeWidth={barW} strokeLinecap="round" />
        );
      })}
      <circle r={r * 0.14} fill={c} />
    </g>
  );
}

function ArrowIcon({ direction }) {
  const up = direction === "up";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {up ? (<>
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </>) : (<>
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="5 12 12 19 19 12" />
      </>)}
    </svg>
  );
}

const COLORS = ["#E8734A", "#D4A27F", "#C7956B"];
let nextId = 0;

export default function App() {
  const logosRef = useRef([]);
  const animRef = useRef(null);
  const [dims, setDims] = useState({ w: 400, h: 600 });
  const [, forceRender] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDims({ w: rect.width, h: rect.height });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const launch = useCallback((dir) => {
    const { w, h } = dims;
    const x = LOGO_R + Math.random() * (w - LOGO_R * 2);
    const speed = LAUNCH_SPEED_MIN + Math.random() * (LAUNCH_SPEED_MAX - LAUNCH_SPEED_MIN);
    const spread = (Math.random() - 0.5) * 0.5;
    const vy = dir === "up" ? -speed : speed;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    logosRef.current.push({
      id: nextId++,
      x,
      y: dir === "up" ? h - LOGO_R : LOGO_R,
      vx: Math.sin(spread) * speed * 0.3,
      vy,
      r: LOGO_R, pressed: false, pressTimer: 0,
      barScales: BASE_BARS.map(() => 1),
      barTargets: BASE_BARS.map(() => 1),
      color,
    });
  }, [dims]);

  useEffect(() => {
    const { w, h } = dims;
    let running = true;
    const step = () => {
      if (!running) return;
      const logos = logosRef.current;
      for (const l of logos) {
        l.vy += GRAVITY;
        l.vx *= FRICTION;
        l.x += l.vx;
        l.y += l.vy;
        if (l.x - l.r < 0) { l.x = l.r; l.vx = Math.abs(l.vx) * BOUNCE; }
        if (l.x + l.r > w) { l.x = w - l.r; l.vx = -Math.abs(l.vx) * BOUNCE; }
        if (l.y + l.r > h) { l.y = h - l.r; l.vy = -Math.abs(l.vy) * BOUNCE; if (Math.abs(l.vy) < 1) l.vy = 0; }
        if (l.y - l.r < 0) { l.y = l.r; l.vy = Math.abs(l.vy) * BOUNCE; }
        for (let i = 0; i < BAR_COUNT; i++) {
          l.barScales[i] += (l.barTargets[i] - l.barScales[i]) * 0.15;
        }
        if (l.pressTimer > 0) {
          l.pressTimer--;
          if (l.pressTimer <= 0) { l.pressed = false; l.barTargets = l.barTargets.map(() => 1); }
        }
      }
      for (let i = 0; i < logos.length; i++) {
        for (let j = i + 1; j < logos.length; j++) {
          const a = logos[i], b = logos[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r;
          if (dist < minDist && dist > 0) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
            const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              a.vx -= dot * nx * BOUNCE; a.vy -= dot * ny * BOUNCE;
              b.vx += dot * nx * BOUNCE; b.vy += dot * ny * BOUNCE;
            }
          }
        }
      }
      forceRender(n => n + 1);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [dims]);

  const handlePointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    for (const l of [...logosRef.current].reverse()) {
      const dx = px - l.x, dy = py - l.y;
      if (dx * dx + dy * dy < (l.r + 8) * (l.r + 8)) {
        l.pressed = true;
        l.pressTimer = 20;
        l.barTargets = BASE_BARS.map(() => 0.4 + Math.random() * 1.2);
        l.vy = -(3 + Math.random() * 4);
        l.vx += (Math.random() - 0.5) * 4;
        break;
      }
    }
  };

  const btnStyle = {
    width: 52, height: 52, borderRadius: "50%",
    background: CLAUDE_ORANGE, border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", flexShrink: 0,
  };

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden" }}>
      <div ref={containerRef} style={{ flex: 1, overflow: "hidden" }}>
        <svg width={dims.w} height={dims.h} style={{ display: "block", cursor: "pointer" }} onPointerDown={handlePointerDown}>
          {logosRef.current.map(l => (
            <ClaudeStarburst key={l.id} x={l.x} y={l.y} r={l.r} pressed={l.pressed} barScales={l.barScales} color={l.color} />
          ))}
          {logosRef.current.length === 0 && (
            <text x={dims.w / 2} y={dims.h / 2} textAnchor="middle" fill="#555" fontSize="15">ボタンを押して打ち上げよう</text>
          )}
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "14px 12px", background: "#2a2a2a", borderTop: "1px solid #333" }}>
        <button onClick={() => launch("up")} style={btnStyle}><ArrowIcon direction="up" /></button>
        <button onClick={() => launch("down")} style={btnStyle}><ArrowIcon direction="down" /></button>
      </div>
    </div>
  );
}
