import { useState, useEffect, useRef, useCallback } from "react";

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
const HIRAGANA = [
  "あ","い","う","え","お",
  "か","き","く","け","こ",
  "さ","し","す","せ","そ",
  "た","ち","つ","て","と",
  "な","に","ぬ","ね","の",
  "は","ひ","ふ","へ","ほ",
  "ま","み","む","め","も",
  "や","ゆ","よ",
  "ら","り","る","れ","ろ",
  "わ","を","ん",
];

const LEVEL_CONFIG = {
  やさしい: { label: "やさしい 🌸", rule: "start", desc: "その文字で はじまる ことば" },
  ふつう:   { label: "ふつう 🌟",   rule: "contain", desc: "その文字が はいっている ことば" },
  むずかしい: { label: "むずかしい 🔥", rule: "contain_not_start", desc: "その文字が はいっている けど はじまらない ことば" },
};

function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function checkRule(rule, word, target) {
  const h = toHiragana(word);
  if (rule === "start") return h.startsWith(target);
  if (rule === "contain") return h.includes(target);
  if (rule === "contain_not_start") return h.includes(target) && !h.startsWith(target);
  return false;
}

function pickRandom(arr, exclude) {
  const pool = arr.filter(x => x !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ────────────────────────────────────────────────
// Claude API: 言葉バリデーション
// ────────────────────────────────────────────────
async function validateWord(word, hiragana, rule) {
  const ruleText = {
    start: `「${hiragana}」で始まる`,
    contain: `「${hiragana}」を含む`,
    contain_not_start: `「${hiragana}」を含むが「${hiragana}」で始まらない`,
  }[rule];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `子供向け言葉ゲームの審判です。
「${word}」は ${ruleText} 実在する日本語の言葉（名詞・動詞・形容詞など）ですか？
小学生が答えることを想定してください。固有名詞（人名・地名・キャラクター名）も正解にしてください。

次のJSONのみで返してください（他の文字禁止）:
{"ok":true,"reason":"理由を20字以内"}
または
{"ok":false,"reason":"理由を20字以内"}`
      }]
    }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text ?? "";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { ok: false, reason: "判定できませんでした" };
  }
}

// ────────────────────────────────────────────────
// Particle burst component
// ────────────────────────────────────────────────
function Particles({ trigger, color }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    setParticles(Array.from({ length: 18 }, (_, i) => ({
      id: Date.now() + i,
      angle: (i / 18) * 360,
      dist: 60 + Math.random() * 60,
      size: 8 + Math.random() * 10,
      emoji: ["⭐","✨","🌟","💫","🎉"][Math.floor(Math.random() * 5)],
    })));
    const t = setTimeout(() => setParticles([]), 1000);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: "50%", top: "50%",
          fontSize: p.size,
          transform: `translate(-50%,-50%) rotate(${p.angle}deg) translateY(-${p.dist}px)`,
          animation: "burst 0.9s ease-out forwards",
        }}>{p.emoji}</div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// Main Game
// ────────────────────────────────────────────────
export default function WordSniper() {
  const [screen, setScreen] = useState("title"); // title | game | result
  const [level, setLevel] = useState("やさしい");
  const [target, setTarget] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | correct | wrong
  const [transcript, setTranscript] = useState("");
  const [reason, setReason] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [history, setHistory] = useState([]);
  const recognitionRef = useRef(null);
  const totalRounds = 10;

  const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ─── next card ───
  const nextCard = useCallback((prev) => {
    setTarget(pickRandom(HIRAGANA, prev));
    setPhase("idle");
    setTranscript("");
    setReason("");
  }, []);

  const startGame = () => {
    setScore(0); setStreak(0); setRound(0); setHistory([]);
    setScreen("game");
    nextCard(null);
  };

  // ─── speech recognition ───
  const startListening = useCallback(() => {
    if (phase !== "idle") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    setPhase("listening");
    setTranscript("");
    rec.start();

    rec.onresult = (e) => {
      const interim = Array.from(e.results).map(r => r[0].transcript).join("");
      setTranscript(interim);
      if (e.results[e.results.length - 1].isFinal) {
        const finals = Array.from(e.results[e.results.length - 1])
          .map(alt => alt.transcript);
        rec.stop();
        judgeWord(finals[0], finals);
      }
    };
    rec.onerror = () => { setPhase("idle"); setTranscript(""); };
    rec.onend = () => { if (phase === "listening") setPhase("idle"); };
  }, [phase, target, level]);

  const judgeWord = useCallback(async (primary, alternatives) => {
    setPhase("thinking");
    setTranscript(primary);
    const rule = LEVEL_CONFIG[level].rule;

    // まずルールチェック（全候補で試す）
    const passing = (alternatives || [primary]).find(w => checkRule(rule, w, target));
    if (!passing) {
      setReason(`「${target}」が${rule === "start" ? "はじまりに" : "なかに"}ありません`);
      setPhase("wrong");
      setStreak(0);
      setHistory(h => [...h, { word: primary, target, ok: false }]);
      scheduleNext(false);
      return;
    }

    // Claude API で実在チェック
    try {
      const { ok, reason: r } = await validateWord(passing, target, rule);
      if (ok) {
        const newStreak = streak + 1;
        const bonus = newStreak >= 3 ? 2 : 1;
        setScore(s => s + bonus);
        setStreak(newStreak);
        setBurstKey(k => k + 1);
        setTranscript(passing);
        setReason(newStreak >= 3 ? `🔥 ${newStreak}連続！ +${bonus}点` : r);
        setPhase("correct");
        setHistory(h => [...h, { word: passing, target, ok: true }]);
      } else {
        setTranscript(passing);
        setReason(r);
        setPhase("wrong");
        setStreak(0);
        setHistory(h => [...h, { word: passing, target, ok: false }]);
      }
      scheduleNext(ok);
    } catch {
      // API失敗時はルールチェックのみで判定
      setPhase("correct");
      setScore(s => s + 1);
      setStreak(s => s + 1);
      setBurstKey(k => k + 1);
      setHistory(h => [...h, { word: passing, target, ok: true }]);
      scheduleNext(true);
    }
  }, [target, level, streak, round]);

  const scheduleNext = useCallback((ok) => {
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= totalRounds) {
      setTimeout(() => setScreen("result"), 1800);
    } else {
      setTimeout(() => nextCard(target), 1600);
    }
  }, [round, target, nextCard]);

  // ─── UI ───
  const cfg = LEVEL_CONFIG[level];

  const bgGrad = {
    title:  "linear-gradient(135deg, #fff9e6 0%, #ffe0f0 50%, #e0f0ff 100%)",
    game:   "linear-gradient(160deg, #f0fff4 0%, #e8f4ff 100%)",
    result: "linear-gradient(135deg, #fff0e0 0%, #ffe0f8 100%)",
  }[screen];

  return (
    <div style={{
      minHeight: "100vh", background: bgGrad,
      fontFamily: "'Noto Sans JP', 'Hiragino Maru Gothic ProN', sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "20px",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');
        @keyframes burst {
          0%   { opacity: 1; transform: translate(-50%,-50%) rotate(var(--a,0deg)) translateY(0); }
          100% { opacity: 0; transform: translate(-50%,-50%) rotate(var(--a,0deg)) translateY(-80px) scale(0.3); }
        }
        @keyframes pop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .card-pop { animation: pop 0.4s cubic-bezier(.34,1.56,.64,1) both; }
        .card-shake { animation: shake 0.5s ease both; }
        .btn:active { transform: scale(0.95); }
      `}</style>

      {/* ══════ TITLE SCREEN ══════ */}
      {screen === "title" && (
        <div style={{ textAlign: "center", maxWidth: 440, width: "100%" }}>
          <div style={{ fontSize: 64, marginBottom: 4, animation: "float 2s ease-in-out infinite" }}>🎯</div>
          <h1 style={{ fontSize: "clamp(28px,6vw,42px)", fontWeight: 900, color: "#1a1a2e",
            letterSpacing: "0.05em", margin: "0 0 6px" }}>
            ことばスナイパー
          </h1>
          <p style={{ color: "#666", fontSize: 14, margin: "0 0 28px" }}>
            ひらがなをみて　ことばをいおう！
          </p>

          {/* level select */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
            {Object.entries(LEVEL_CONFIG).map(([lv, { label }]) => (
              <button key={lv} className="btn" onClick={() => setLevel(lv)} style={{
                padding: "10px 18px", borderRadius: 50, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                background: level === lv ? "#ff6b9d" : "#fff",
                color: level === lv ? "#fff" : "#555",
                boxShadow: level === lv ? "0 4px 16px #ff6b9d66" : "0 2px 8px #0001",
                transition: "all 0.2s",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ background: "#fff8", borderRadius: 16, padding: "14px 20px",
            marginBottom: 28, fontSize: 14, color: "#444", backdropFilter: "blur(8px)" }}>
            📖 <strong>ルール：</strong> {cfg.desc}
          </div>

          {!hasSpeech && (
            <div style={{ background: "#fff3cd", borderRadius: 12, padding: "12px 16px",
              marginBottom: 16, fontSize: 13, color: "#856404" }}>
              ⚠️ このブラウザは音声認識に対応していません。<br />
              Chrome または Edge をお使いください。
            </div>
          )}

          <button className="btn" onClick={startGame} disabled={!hasSpeech} style={{
            padding: "18px 48px", borderRadius: 50, border: "none", cursor: hasSpeech ? "pointer" : "not-allowed",
            fontSize: 20, fontWeight: 900, fontFamily: "inherit",
            background: hasSpeech ? "linear-gradient(135deg,#ff6b9d,#ff8e53)" : "#ccc",
            color: "#fff", boxShadow: hasSpeech ? "0 6px 24px #ff6b9d55" : "none",
            transition: "all 0.2s",
          }}>
            はじめる！
          </button>
        </div>
      )}

      {/* ══════ GAME SCREEN ══════ */}
      {screen === "game" && target && (
        <div style={{ textAlign: "center", maxWidth: 420, width: "100%", position: "relative" }}>
          {/* header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 20, padding: "0 4px" }}>
            <div style={{ background: "#fff8", borderRadius: 20, padding: "6px 16px",
              fontWeight: 700, fontSize: 15, color: "#1a1a2e", backdropFilter: "blur(8px)" }}>
              ⭐ {score}点
            </div>
            <div style={{ background: "#fff8", borderRadius: 20, padding: "6px 16px",
              fontSize: 13, color: "#666", backdropFilter: "blur(8px)" }}>
              {round}/{totalRounds}
            </div>
            {streak >= 3 && (
              <div style={{ background: "linear-gradient(135deg,#ff6b35,#f7931e)",
                borderRadius: 20, padding: "6px 16px", fontWeight: 700, fontSize: 14, color: "#fff" }}>
                🔥 {streak}連続
              </div>
            )}
          </div>

          {/* rule hint */}
          <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>{cfg.desc}</p>

          {/* main hiragana card */}
          <div style={{ position: "relative", marginBottom: 24 }}>
            <Particles trigger={burstKey} />
            <div key={target} className={
              phase === "correct" ? "card-pop" :
              phase === "wrong"   ? "card-shake" : ""
            } style={{
              width: 180, height: 180, margin: "0 auto",
              borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 96, fontWeight: 900, userSelect: "none",
              background: phase === "correct" ? "linear-gradient(135deg,#56ab2f,#a8e063)"
                        : phase === "wrong"   ? "linear-gradient(135deg,#ff416c,#ff4b2b)"
                        : "linear-gradient(135deg,#667eea,#764ba2)",
              color: "#fff",
              boxShadow: phase === "correct" ? "0 8px 40px #56ab2f66"
                       : phase === "wrong"   ? "0 8px 40px #ff416c66"
                       : "0 8px 40px #667eea44",
              transition: "background 0.3s, box-shadow 0.3s",
            }}>
              {target}
            </div>
          </div>

          {/* transcript / status area */}
          <div style={{ minHeight: 72, marginBottom: 24, display: "flex",
            flexDirection: "column", alignItems: "center", gap: 6 }}>
            {phase === "listening" && (
              <>
                <div style={{ fontSize: 13, color: "#888" }}>👂 きいています…</div>
                <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6 + i * 4, borderRadius: 3,
                      background: "#667eea",
                      animation: `pulse 0.6s ease-in-out ${i * 0.1}s infinite`,
                    }} />
                  ))}
                </div>
                {transcript && <div style={{ fontSize: 22, fontWeight: 700, color: "#333" }}>{transcript}</div>}
              </>
            )}
            {phase === "thinking" && (
              <>
                <div style={{ fontSize: 13, color: "#888" }}>🤔 かんがえています…</div>
                <div style={{ width: 32, height: 32, border: "4px solid #667eea33",
                  borderTopColor: "#667eea", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontSize: 22, fontWeight: 700, color: "#333" }}>{transcript}</div>
              </>
            )}
            {phase === "correct" && (
              <>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#56ab2f" }}>✅ せいかい！</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#333" }}>「{transcript}」</div>
                {reason && <div style={{ fontSize: 13, color: "#56ab2f", fontWeight: 700 }}>{reason}</div>}
              </>
            )}
            {phase === "wrong" && (
              <>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#ff416c" }}>❌ ざんねん…</div>
                {transcript && <div style={{ fontSize: 20, color: "#666" }}>「{transcript}」</div>}
                {reason && <div style={{ fontSize: 13, color: "#ff416c" }}>{reason}</div>}
              </>
            )}
            {phase === "idle" && (
              <div style={{ fontSize: 15, color: "#999" }}>
                下のボタンを押してことばをいおう！
              </div>
            )}
          </div>

          {/* mic button */}
          <button className="btn" onClick={startListening}
            disabled={phase !== "idle"}
            style={{
              width: 80, height: 80, borderRadius: "50%", border: "none",
              cursor: phase === "idle" ? "pointer" : "not-allowed",
              fontSize: 36,
              background: phase === "idle"
                ? "linear-gradient(135deg,#ff6b9d,#ff8e53)"
                : "#ddd",
              boxShadow: phase === "idle" ? "0 6px 24px #ff6b9d55" : "none",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto",
            }}>
            🎤
          </button>

          {/* skip */}
          <button className="btn" onClick={() => { setStreak(0); nextCard(target); setRound(r => r + 1); }}
            disabled={phase !== "idle"}
            style={{ marginTop: 14, padding: "8px 20px", borderRadius: 20, border: "none",
              cursor: phase === "idle" ? "pointer" : "not-allowed",
              background: "transparent", color: "#aaa", fontSize: 13, fontFamily: "inherit" }}>
            スキップ →
          </button>
        </div>
      )}

      {/* ══════ RESULT SCREEN ══════ */}
      {screen === "result" && (
        <div style={{ textAlign: "center", maxWidth: 440, width: "100%" }}>
          <div style={{ fontSize: 64, marginBottom: 8, animation: "float 2s ease-in-out infinite" }}>
            {score >= 16 ? "🏆" : score >= 10 ? "🎖️" : "🎉"}
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: "#1a1a2e", margin: "0 0 4px" }}>
            おわった！
          </h2>
          <div style={{ fontSize: 52, fontWeight: 900,
            background: "linear-gradient(135deg,#667eea,#764ba2)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 6 }}>
            {score} 点
          </div>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>
            {score >= 16 ? "すごい！パーフェクトにちかい！" :
             score >= 10 ? "よくできました！" : "またちょうせんしよう！"}
          </div>

          {/* history */}
          <div style={{ background: "#fff8", borderRadius: 16, padding: 16,
            backdropFilter: "blur(8px)", marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#555", marginBottom: 10 }}>
              こたえのきろく
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  background: h.ok ? "#e8f8e8" : "#ffeef0",
                  border: `1.5px solid ${h.ok ? "#56ab2f44" : "#ff416c44"}`,
                  borderRadius: 10, padding: "5px 12px",
                  fontSize: 13, color: h.ok ? "#2d7a2d" : "#c0392b",
                }}>
                  <span style={{ fontWeight: 700, marginRight: 4 }}>{h.target}</span>
                  {h.word ? `→ ${h.word}` : "スキップ"}
                  {" "}{h.ok ? "✅" : "❌"}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn" onClick={startGame} style={{
              padding: "16px 36px", borderRadius: 50, border: "none", cursor: "pointer",
              fontSize: 17, fontWeight: 900, fontFamily: "inherit",
              background: "linear-gradient(135deg,#ff6b9d,#ff8e53)",
              color: "#fff", boxShadow: "0 6px 24px #ff6b9d55",
            }}>もう一度！</button>
            <button className="btn" onClick={() => setScreen("title")} style={{
              padding: "16px 36px", borderRadius: 50, border: "none", cursor: "pointer",
              fontSize: 17, fontWeight: 900, fontFamily: "inherit",
              background: "#fff", color: "#667eea",
              boxShadow: "0 4px 16px #0001",
            }}>タイトルへ</button>
          </div>
        </div>
      )}
    </div>
  );
}
