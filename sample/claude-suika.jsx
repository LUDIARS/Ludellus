import { useState, useRef, useEffect, useCallback } from "react";

const GRAVITY = 0.28;
const BOUNCE = 0.32;
const FRICTION = 0.989;
const BG = "#0e0e1c";

const ALL_COLORS = ["#E8734A", "#52C964", "#4A8FE8", "#C050E8", "#E8C830"];
const COLOR_LABELS = ["Orange", "Green", "Blue", "Purple", "Yellow"];
const RADII = [16, 22, 31, 43, 59];
const MERGE_SCORE = [0, 10, 30, 70, 150, 350];
const DANGER_Y = 52;
const NEW_GRACE = 90;
const LAUNCH_COOLDOWN = 380;

// Burst config
const BURST_DURATION = 28;       // frames bars stay expanded
const BURST_BAR_SCALE_MIN = 1.5;
const BURST_BAR_SCALE_MAX = 2.6;
const BURST_LERP = 0.18;         // how fast bars spring out
const BURST_RETURN_LERP = 0.09;  // how fast bars return
const BURST_RADIUS_MULT = 2.4;   // blast radius relative to logo r
const BURST_FORCE_BASE = 5.5;    // impulse strength

const BAR_COUNT = 11;
const BASE_BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
  const lengths = [0.95, 0.78, 1.0, 0.72, 0.88, 0.65, 0.92, 0.7, 0.85, 0.75, 0.82];
  return { angle, baseLen: lengths[i] };
});

// ── Components ──────────────────────────────────────────────────────────────

function ClaudeStarburst({ x, y, r, color, barScales }) {
  const barW = Math.max(1.5, r * 0.17);
  const glowScale = barScales ? Math.max(...barScales) : 1;
  return (
    <g transform={`translate(${x},${y})`}>
      {/* glow ring that reacts to burst */}
      <circle r={r * 1.05 * glowScale * 0.7} fill={color}
        opacity={barScales ? Math.min(0.22, (glowScale - 1) * 0.28) : 0} />
      {BASE_BARS.map((bar, i) => {
        const sc = barScales ? barScales[i] : 1;
        const len = r * 0.9 * bar.baseLen * sc;
        return (
          <line key={i} x1={0} y1={0}
            x2={Math.cos(bar.angle) * len}
            y2={Math.sin(bar.angle) * len}
            stroke={color} strokeWidth={barW} strokeLinecap="round" opacity={0.93} />
        );
      })}
      <circle r={r * 0.11} fill={color} />
    </g>
  );
}

function MergeFlash({ x, y, r, color }) {
  return (
    <g transform={`translate(${x},${y})`} style={{ pointerEvents: "none" }}>
      <circle fill={color} r={r * 0.5}>
        <animate attributeName="r" from={r * 0.5} to={r * 2.8} dur="0.38s" fill="freeze" />
        <animate attributeName="opacity" values="0.55;0.3;0" dur="0.38s" fill="freeze" />
      </circle>
    </g>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let nextId = 0;

function makeLogo(x, y, level, colorIdx, vx = 0, vy = 3) {
  return {
    id: nextId++, x, y, vx, vy,
    r: RADII[level - 1], level, colorIdx, grace: NEW_GRACE,
    barScales: Array(BAR_COUNT).fill(1),
    barTargets: Array(BAR_COUNT).fill(1),
    burstTimer: 0,
  };
}

function getColorCount(drops) {
  if (drops >= 40) return 5;
  if (drops >= 20) return 4;
  return 3;
}

function rndPiece(colorCount) {
  const level = Math.random() < 0.2 ? (Math.floor(Math.random() * 5) + 1) : 1;
  return { level, colorIdx: Math.floor(Math.random() * colorCount) };
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const logosRef       = useRef([]);
  const animRef        = useRef(null);
  const containerRef   = useRef(null);
  const [dims, setDims]           = useState({ w: 400, h: 600 });
  const [, forceRender]           = useState(0);
  const [launchX, setLaunchX]     = useState(200);
  const launchXRef                = useRef(200);
  const dropCountRef              = useRef(0);
  const [dropCount, setDropCount] = useState(0);
  const [curPiece, setCurPiece]   = useState(() => ({ level: 1, colorIdx: 0 }));
  const curPieceRef               = useRef({ level: 1, colorIdx: 0 });
  const [nextPiece, setNextPiece] = useState(() => ({ level: 1, colorIdx: 1 }));
  const nextPieceRef              = useRef({ level: 1, colorIdx: 1 });
  const [score, setScore]         = useState(0);
  const [gameOver, setGameOver]   = useState(false);
  const gameOverRef               = useRef(false);
  const canLaunchRef              = useRef(true);
  const isDraggingRef             = useRef(false);
  const [flashes, setFlashes]     = useState([]);
  const [newColorAlert, setNewColorAlert] = useState(null);

  useEffect(() => { curPieceRef.current  = curPiece;  }, [curPiece]);
  useEffect(() => { nextPieceRef.current = nextPiece; }, [nextPiece]);

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDims({ w: rect.width, h: rect.height });
      const mid = rect.width / 2;
      setLaunchX(mid); launchXRef.current = mid;
    };
    measure();
    const p = rndPiece(3), np = rndPiece(3);
    curPieceRef.current = p;  setCurPiece(p);
    nextPieceRef.current = np; setNextPiece(np);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Launch
  const launch = useCallback(() => {
    if (gameOverRef.current || !canLaunchRef.current) return;
    const p = curPieceRef.current;
    logosRef.current.push(makeLogo(launchXRef.current, DANGER_Y + RADII[p.level - 1] + 2, p.level, p.colorIdx));

    const prevDrop = dropCountRef.current;
    const newDrop  = prevDrop + 1;
    dropCountRef.current = newDrop;
    setDropCount(newDrop);

    const prevCC = getColorCount(prevDrop);
    const newCC  = getColorCount(newDrop);
    if (newCC > prevCC) {
      setNewColorAlert(COLOR_LABELS[newCC - 1]);
      setTimeout(() => setNewColorAlert(null), 2400);
    }

    const np  = nextPieceRef.current;
    const nnp = rndPiece(newCC);
    curPieceRef.current  = np;  setCurPiece(np);
    nextPieceRef.current = nnp; setNextPiece(nnp);
    canLaunchRef.current = false;
    setTimeout(() => { canLaunchRef.current = true; }, LAUNCH_COOLDOWN);
  }, []);

  // Burst a logo (tap)
  const burstLogo = useCallback((logo) => {
    // Animate bars
    logo.burstTimer  = BURST_DURATION;
    logo.barTargets  = BASE_BARS.map(() =>
      BURST_BAR_SCALE_MIN + Math.random() * (BURST_BAR_SCALE_MAX - BURST_BAR_SCALE_MIN));

    // Physical impulse: push all nearby logos outward
    const blastR = logo.r * BURST_RADIUS_MULT;
    for (const other of logosRef.current) {
      if (other.id === logo.id) continue;
      const dx = other.x - logo.x;
      const dy = other.y - logo.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < blastR + other.r) {
        const falloff = 1 - Math.min(1, dist / (blastR + other.r));
        const force   = BURST_FORCE_BASE * falloff * (logo.r / 16); // bigger logo = bigger blast
        other.vx += (dx / dist) * force;
        other.vy += (dy / dist) * force - 1.2; // slight upward bias
      }
    }
    // Self-bounce upward slightly
    logo.vy -= 2.5 + logo.r * 0.05;
  }, []);

  // Physics loop
  useEffect(() => {
    const { w, h } = dims;
    let running = true;
    const step = () => {
      if (!running) return;
      if (!gameOverRef.current) {
        const logos = logosRef.current;

        // Move + bar animation
        for (const l of logos) {
          l.vy += GRAVITY; l.vx *= FRICTION;
          l.x  += l.vx;   l.y  += l.vy;
          if (l.x - l.r < 1)     { l.x = l.r + 1;     l.vx =  Math.abs(l.vx) * BOUNCE; }
          if (l.x + l.r > w - 1) { l.x = w - l.r - 1; l.vx = -Math.abs(l.vx) * BOUNCE; }
          if (l.y + l.r > h - 1) { l.y = h - l.r - 1; l.vy = -Math.abs(l.vy) * BOUNCE; if (Math.abs(l.vy) < 0.6) l.vy = 0; }
          if (l.y - l.r < 0)     { l.y = l.r;          l.vy =  Math.abs(l.vy) * BOUNCE; }
          if (l.grace > 0) l.grace--;

          // Bar spring animation
          if (l.burstTimer > 0) {
            l.burstTimer--;
            if (l.burstTimer <= 0) l.barTargets = Array(BAR_COUNT).fill(1);
          }
          for (let i = 0; i < BAR_COUNT; i++) {
            const lerp = l.barTargets[i] > l.barScales[i] ? BURST_LERP : BURST_RETURN_LERP;
            l.barScales[i] += (l.barTargets[i] - l.barScales[i]) * lerp;
          }
        }

        // Collision + merge
        const mergeIds = new Set();
        const mergeQueue = [];
        for (let i = 0; i < logos.length; i++) {
          for (let j = i + 1; j < logos.length; j++) {
            const a = logos[i], b = logos[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist2 = dx * dx + dy * dy;
            const md = a.r + b.r;
            if (dist2 >= md * md) continue;
            const dist = Math.sqrt(dist2) || 0.001;

            if (a.level === b.level && a.colorIdx === b.colorIdx
                && !mergeIds.has(a.id) && !mergeIds.has(b.id)) {
              mergeIds.add(a.id); mergeIds.add(b.id);
              mergeQueue.push({
                x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                vx: (a.vx + b.vx) * 0.35,
                vy: Math.min((a.vy + b.vy) * 0.35, -1.5),
                level: a.level + 1, colorIdx: a.colorIdx,
                sc: MERGE_SCORE[a.level], r: RADII[a.level - 1],
              });
            } else if (!mergeIds.has(a.id) && !mergeIds.has(b.id)) {
              const nx = dx / dist, ny = dy / dist;
              const ov = md - dist;
              a.x -= nx * ov * 0.5; a.y -= ny * ov * 0.5;
              b.x += nx * ov * 0.5; b.y += ny * ov * 0.5;
              const dot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
              if (dot > 0) {
                a.vx -= dot * nx * BOUNCE; a.vy -= dot * ny * BOUNCE;
                b.vx += dot * nx * BOUNCE; b.vy += dot * ny * BOUNCE;
              }
            }
          }
        }

        if (mergeQueue.length > 0) {
          logosRef.current = logos.filter(l => !mergeIds.has(l.id));
          let addScore = 0;
          const newFlashes = [];
          for (const m of mergeQueue) {
            addScore += m.sc;
            const flashR = m.level <= 5 ? RADII[m.level - 1] : m.r * 1.5;
            newFlashes.push({ id: nextId++, x: m.x, y: m.y, r: flashR, color: ALL_COLORS[m.colorIdx] });
            if (m.level <= 5) {
              const nl = makeLogo(m.x, m.y, m.level, m.colorIdx, m.vx, m.vy);
              nl.grace = 25;
              logosRef.current.push(nl);
            }
          }
          if (addScore > 0) setScore(s => s + addScore);
          if (newFlashes.length > 0) {
            setFlashes(p => [...p, ...newFlashes]);
            setTimeout(() => setFlashes(p => p.filter(f => !newFlashes.find(n => n.id === f.id))), 420);
          }
        }

        // Game over check
        for (const l of logosRef.current) {
          if (l.grace <= 0 && l.y - l.r < DANGER_Y) {
            gameOverRef.current = true; setGameOver(true); break;
          }
        }
      }
      forceRender(n => n + 1);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [dims]);

  // Tap on game area → find hit logo → burst
  const handleGamePointerDown = useCallback((e) => {
    if (gameOverRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // hit-test in reverse (topmost first)
    for (const l of [...logosRef.current].reverse()) {
      const dx = px - l.x, dy = py - l.y;
      if (dx * dx + dy * dy < (l.r + 6) * (l.r + 6)) {
        burstLogo(l);
        break;
      }
    }
  }, [burstLogo]);

  const handleBarMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const r  = RADII[curPieceRef.current.level - 1];
    const c  = Math.max(r + 4, Math.min(dims.w - r - 4, px));
    setLaunchX(c); launchXRef.current = c;
  }, [dims.w]);

  const reset = useCallback(() => {
    logosRef.current = [];
    gameOverRef.current = false; canLaunchRef.current = true; isDraggingRef.current = false;
    setGameOver(false); setScore(0); setFlashes([]); setNewColorAlert(null);
    dropCountRef.current = 0; setDropCount(0);
    const p = rndPiece(3), np = rndPiece(3);
    curPieceRef.current = p;  setCurPiece(p);
    nextPieceRef.current = np; setNextPiece(np);
    const mid = dims.w / 2; setLaunchX(mid); launchXRef.current = mid;
  }, [dims.w]);

  const colorCount = getColorCount(dropCount);
  const curColor   = ALL_COLORS[curPiece.colorIdx];
  const nextColor  = ALL_COLORS[nextPiece.colorIdx];
  const nextR      = RADII[nextPiece.level - 1];
  const curR       = RADII[curPiece.level - 1];
  const lx         = Math.max(curR + 4, Math.min(dims.w - curR - 4, launchX));

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden", userSelect: "none", fontFamily: "monospace" }}>

      {/* ── Header ── */}
      <div style={{ padding: "6px 14px", background: "#11112a", borderBottom: "1px solid #202038", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <div style={{ color: "#555", fontSize: 9, letterSpacing: 2 }}>SCORE</div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: "bold", lineHeight: 1.15 }}>{score}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
            {ALL_COLORS.map((c, i) => (
              <div key={i} title={COLOR_LABELS[i]} style={{
                width: 9, height: 9, borderRadius: "50%",
                background: i < colorCount ? c : "#202030",
                transition: "background 0.6s, box-shadow 0.6s",
                boxShadow: i < colorCount ? `0 0 6px ${c}99` : "none",
              }} />
            ))}
            {colorCount < 5 && (
              <span style={{ color: "#3a3a50", fontSize: 9, marginLeft: 1 }}>
                {dropCount % 20}/20
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#444", fontSize: 9, letterSpacing: 2, marginBottom: 3 }}>NEXT</div>
            <svg width={nextR * 3} height={nextR * 3} style={{ display: "block", overflow: "visible", margin: "0 auto" }}>
              <ClaudeStarburst x={nextR * 1.5} y={nextR * 1.5} r={nextR} color={nextColor} barScales={null} />
            </svg>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#444", fontSize: 9, letterSpacing: 1 }}>DROPS</div>
            <div style={{ color: "#888", fontSize: 18, fontWeight: "bold" }}>{dropCount}</div>
          </div>
        </div>
      </div>

      {/* ── Game area ── */}
      <div ref={containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <svg width={dims.w} height={dims.h} style={{ display: "block", cursor: "pointer" }}
          onPointerDown={handleGamePointerDown}>

          {/* Walls */}
          <rect x={0}        y={0} width={2}      height={dims.h} fill="#20204a" />
          <rect x={dims.w-2} y={0} width={2}      height={dims.h} fill="#20204a" />
          <rect x={0} y={dims.h-2} width={dims.w} height={2}      fill="#20204a" />

          {/* Danger zone */}
          <rect x={2} y={0} width={dims.w-4} height={DANGER_Y} fill="#ff2233" opacity={0.05} />
          <line x1={0} y1={DANGER_Y} x2={dims.w} y2={DANGER_Y} stroke="#ff3344" strokeWidth={1.5} strokeDasharray="8,5" opacity={0.6} />
          <text x={6} y={DANGER_Y-5} fill="#ff3344" fontSize={9} opacity={0.5} fontFamily="monospace">GAME OVER LINE</text>

          {/* Guide + launcher piece */}
          {!gameOver && <>
            <line x1={lx} y1={DANGER_Y} x2={lx} y2={dims.h-2}
              stroke={curColor} strokeWidth={0.8} opacity={0.15} strokeDasharray="4,6" />
            <ClaudeStarburst x={lx} y={DANGER_Y - curR - 5} r={curR} color={curColor} barScales={null} />
          </>}

          {/* Active logos */}
          {logosRef.current.map(l => (
            <ClaudeStarburst key={l.id}
              x={l.x} y={l.y} r={l.r}
              color={ALL_COLORS[l.colorIdx]}
              barScales={l.barScales} />
          ))}

          {/* Merge flashes */}
          {flashes.map(f => <MergeFlash key={f.id} x={f.x} y={f.y} r={f.r} color={f.color} />)}

          {/* Color unlock toast */}
          {newColorAlert && (
            <g>
              <rect x={dims.w/2-92} y={dims.h/2-28} width={184} height={46}
                rx={10} fill="#0e0e1c" stroke={ALL_COLORS[colorCount-1]} strokeWidth={1.5} opacity={0.97} />
              <text x={dims.w/2} y={dims.h/2-8}  textAnchor="middle" fill="#666" fontSize={10} fontFamily="monospace">NEW COLOR UNLOCKED</text>
              <text x={dims.w/2} y={dims.h/2+12} textAnchor="middle" fill={ALL_COLORS[colorCount-1]} fontSize={16} fontWeight="bold" fontFamily="monospace">✦ {newColorAlert} ✦</text>
            </g>
          )}

          {/* Game over overlay */}
          {gameOver && <>
            <rect x={0} y={0} width={dims.w} height={dims.h} fill="#000" opacity={0.74} />
            <text x={dims.w/2} y={dims.h/2-36} textAnchor="middle" fill="#fff"     fontSize={34} fontWeight="bold" fontFamily="monospace">GAME OVER</text>
            <text x={dims.w/2} y={dims.h/2+4}  textAnchor="middle" fill="#999"     fontSize={20} fontFamily="monospace">Score: {score}</text>
            <text x={dims.w/2} y={dims.h/2+38} textAnchor="middle" fill="#E8734A"  fontSize={13} opacity={0.85} fontFamily="monospace">Tap ↺ to retry</text>
          </>}
        </svg>
      </div>

      {/* ── Bottom bar ── */}
      <div
        style={{ height: 66, background: "#11112a", borderTop: "1px solid #202038", position: "relative", touchAction: "none", flexShrink: 0, cursor: isDraggingRef.current ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          if (gameOver) return;
          isDraggingRef.current = true;
          handleBarMove(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => { if (isDraggingRef.current) handleBarMove(e); }}
        onPointerUp={() => { if (isDraggingRef.current) { isDraggingRef.current = false; launch(); } }}
        onPointerCancel={() => { isDraggingRef.current = false; }}
      >
        <div style={{ position: "absolute", top: "50%", left: 14, right: 14, height: 2, background: "#1a1a32", borderRadius: 1, transform: "translateY(-50%)", pointerEvents: "none" }} />

        {gameOver ? (
          <button onClick={reset} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 50, height: 50, borderRadius: "50%", background: "#2e2e48", border: "2px solid rgba(255,255,255,0.15)", cursor: "pointer", color: "#ccc", fontSize: 22, fontWeight: "bold" }}>↺</button>
        ) : (
          <div style={{ position: "absolute", left: lx, top: "50%", transform: "translate(-50%,-50%)", width: 50, height: 50, borderRadius: "50%", background: curColor, border: "2.5px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: "bold", boxShadow: `0 0 18px ${curColor}55`, pointerEvents: "none" }}>↑</div>
        )}

        <div style={{ position: "absolute", bottom: 5, left: 0, right: 0, textAlign: "center", color: "#2a2a42", fontSize: 9, letterSpacing: 1, pointerEvents: "none" }}>
          {gameOver ? "— GAME OVER —" : "DRAG TO AIM  ·  RELEASE TO DROP"}
        </div>
      </div>
    </div>
  );
}
