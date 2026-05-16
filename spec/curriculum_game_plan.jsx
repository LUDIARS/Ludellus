import { useState } from "react";

const CURRICULUM = {
  low: {
    label: "低学年",
    grades: "1・2年生",
    age: "6〜8歳",
    subjects: [
      {
        name: "国語",
        goals: "ひらがな・カタカナ・漢字80字の習得、文の基本構造、音読・読み聞かせ",
        requirements: "平仮名・片仮名を読み書き、短い文を書く、物語の読み取り",
      },
      {
        name: "算数",
        goals: "数の概念(〜100→1000)、加減乗除の基礎、図形・時計の読み方",
        requirements: "繰り上がり繰り下がりの計算、三角形・四角形の識別、時刻の読解",
      },
      {
        name: "生活",
        goals: "自分・家族・地域・自然への関心、植物栽培・動物飼育、季節の変化",
        requirements: "身近な生き物の観察記録、地域探検、安全な生活習慣",
      },
      {
        name: "音楽",
        goals: "歌唱・鑑賞・リズム感の基礎、打楽器の演奏",
        requirements: "歌に合わせた体表現、リズムの模倣、音の高低・長短の識別",
      },
      {
        name: "図画工作",
        goals: "描く・作る・鑑賞の基礎、素材への興味",
        requirements: "自由な表現活動、身近な材料を使った工作、色の識別と混色",
      },
      {
        name: "体育",
        goals: "基本的な運動（走・跳・投）、ゲームの楽しみ方、水慣れ",
        requirements: "固定遊具・ボール遊び、水の中での基本動作",
      },
      {
        name: "道徳",
        goals: "礼儀・善悪の判断・生命尊重・家族愛",
        requirements: "挨拶と感謝、約束・きまりを守る、生き物を大切にする",
      },
    ],
    devTasks: [
      "基本的な読み書き・計算の習得（勤勉性の芽生え）",
      "身体的技能の発達（走る・跳ぶ・書く）",
      "仲間との共同遊び・ルール理解",
      "自己概念の形成（「できる/できない」の認識）",
      "家族・学校への帰属感と安心感",
    ],
    piaget: "具体的操作期（前半）",
    erikson: "勤勉性 vs 劣等感",
    color: "#4ade80",
    bg: "#052e16",
  },
  mid: {
    label: "中学年",
    grades: "3・4年生",
    age: "8〜10歳",
    subjects: [
      {
        name: "国語",
        goals: "漢字202字（累計）、段落・文章構造の理解、説明文・物語文の読解",
        requirements: "接続語・段落の理解、要点まとめ、ローマ字の読み書き",
      },
      {
        name: "社会",
        goals: "地域社会・都道府県・日本の地理、産業と人々の生活",
        requirements: "地図の読み方、身近な地域の特色、農業・工業・商業の学習",
      },
      {
        name: "算数",
        goals: "大きな数・小数・分数・面積・折れ線グラフ",
        requirements: "億・兆の概念、小数の計算、概念的な分数、面積の公式",
      },
      {
        name: "理科",
        goals: "植物の成長・昆虫の体・天気・磁石・電気回路",
        requirements: "観察日記、実験の仮説と検証、昆虫の変態、磁力の性質",
      },
      {
        name: "外国語活動",
        goals: "英語への親しみ、挨拶・数・色・身の回りの言葉",
        requirements: "英語の音声に慣れ親しむ、簡単な応答、アルファベットの認識",
      },
      {
        name: "音楽",
        goals: "リコーダー演奏、合唱・合奏の協調",
        requirements: "リコーダーの基本運指、楽譜の読み取り、合わせて歌う・弾く",
      },
      {
        name: "体育",
        goals: "跳び箱・鉄棒・マット運動、ゲームの発展、泳力の向上",
        requirements: "器械運動の基本技、ボールゲームのルール理解、25m泳法",
      },
      {
        name: "道徳",
        goals: "友情・勤勉・地域への愛着・公正・正直",
        requirements: "友人関係の大切さ、努力と忍耐、地域社会への関心",
      },
    ],
    devTasks: [
      "論理的・因果的思考の発達",
      "チームワーク・役割分担の体得",
      "自己評価と比較による競争心・向上心",
      "道徳的判断力（公正・不公平の感覚）",
      "地域・社会への興味と関心の拡大",
    ],
    piaget: "具体的操作期（後半）",
    erikson: "勤勉性の深化・社会的比較",
    color: "#60a5fa",
    bg: "#0c1a2e",
  },
  high: {
    label: "高学年",
    grades: "5・6年生",
    age: "10〜12歳",
    subjects: [
      {
        name: "国語",
        goals: "漢字1006字（全学習漢字）、敬語・要約・論説文の読解と作文",
        requirements: "論の展開を追う、意見文・報告文の作成、敬体・常体の使い分け",
      },
      {
        name: "社会",
        goals: "日本の歴史（縄文〜現代）・政治の仕組み・国際社会",
        requirements: "年表の読み取り、憲法・三権分立、地球規模課題の理解",
      },
      {
        name: "算数",
        goals: "割合・速さ・比例・反比例・統計・立体図形",
        requirements: "百分率・比の計算、関数の概念、統計グラフの作成と解釈",
      },
      {
        name: "理科",
        goals: "植物の働き・動物の体・天体・電流と磁界・水溶液",
        requirements: "光合成の仕組み、人体の器官、天体の動き、電磁石の応用",
      },
      {
        name: "家庭",
        goals: "衣食住の基本・調理・裁縫・家族の生活と環境",
        requirements: "炊飯・みそ汁など基本調理、手縫いの基本、生活設計の考え方",
      },
      {
        name: "外国語",
        goals: "英語4技能（聞く・読む・話す・書く）の基礎、簡単な文の構造",
        requirements: "自己紹介・学校生活・地域の紹介、アルファベット書き取り、語順の理解",
      },
      {
        name: "体育",
        goals: "体力テスト・陸上競技・球技・武道/ダンス・保健",
        requirements: "記録測定と分析、チームスポーツの戦術、思春期の体の変化の理解",
      },
      {
        name: "道徳",
        goals: "公正・正義・勤労・国際理解・環境・生命の尊さ",
        requirements: "多様な立場からの考え方、社会貢献への意識、地球環境への責任",
      },
    ],
    devTasks: [
      "抽象的・仮説的思考の萌芽（形式的操作の入口）",
      "深い友人関係の形成（親友・同性グループ）",
      "身体変化・性差への意識と自己理解",
      "社会的役割・責任感・リーダーシップの体得",
      "将来の職業・目標・自己像への関心",
    ],
    piaget: "形式的操作期（入口）",
    erikson: "アイデンティティ探索の萌芽",
    color: "#f472b6",
    bg: "#1a0a14",
  },
};

const GAME_PLAN = {
  title: "まなびのたびびと",
  subtitle: "〜知識の大地を駆け抜ける旅〜",
  concept:
    "小学校学習指導要領の内容を自然に体験できる冒険RPG。プレイヤーは「たびびと」として広大な知識の大地を旅し、各地で出会う課題を解くことで学習要件を達成していく。",
  target: "小学校1〜6年生（段階別コンテンツ）",
  platform: "タブレット / PC（ブラウザ）",
  mechanics: [
    {
      grade: "低学年コース",
      theme: "「きのくに」の探索",
      desc: "ひらがな・カタカナを使って仲間に話しかけ、地域の生き物を観察・育てながらマップを広げていく。計算パズルで橋を渡り、音楽ゲームで扉を開ける。",
      devAlign: "ルール理解・身体感覚・帰属感",
      icon: "🌱",
    },
    {
      grade: "中学年コース",
      theme: "「しらない町」への旅",
      desc: "都市・農村・海辺など異なる地域を訪問し、地図を作りながら社会の仕組みを学ぶ。仲間NPCとチームを組み役割分担で課題を解決。理科実験ミニゲームで謎を解明。",
      devAlign: "因果思考・チームワーク・社会的比較",
      icon: "🗺️",
    },
    {
      grade: "高学年コース",
      theme: "「むかしとみらい」の架け橋",
      desc: "歴史・現代・未来の三つの時代を行き来するタイムトラベルRPG。政治・環境・国際問題に直面し、仮説を立てて行動する戦略要素。英語でのNPC交流も必須。",
      devAlign: "抽象思考・アイデンティティ・社会責任",
      icon: "⚗️",
    },
  ],
  crossCutting: [
    { feature: "プログラミング的思考", desc: "フローチャートで魔法の呪文を設計、NPCに命令を組み合わせて届ける", icon: "💻" },
    { feature: "道徳的選択", desc: "ストーリー分岐で倫理的ジレンマを体験、選択の結果が世界に反映される", icon: "⚖️" },
    { feature: "外国語NPC", desc: "異国のキャラクターとの英語コミュニケーション（低学年は音声のみ、高学年は文字入力）", icon: "🌍" },
    { feature: "総合的探究ボード", desc: "各教科の知識を組み合わせて「プロジェクト」を完成させる複合課題", icon: "🔬" },
    { feature: "発達課題ゲージ", desc: "協力/競争/創造/思考の4軸で成長を可視化、プレイスタイルで変化", icon: "📊" },
  ],
};

export default function CurriculumGamePlan() {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedGrade, setExpandedGrade] = useState("low");
  const [expandedSubject, setExpandedSubject] = useState(null);

  const grades = Object.entries(CURRICULUM);

  return (
    <div style={{
      fontFamily: "'Noto Serif JP', Georgia, serif",
      background: "#09090b",
      minHeight: "100vh",
      color: "#e4e4e7",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a0533 0%, #0a1628 50%, #001a0a 100%)",
        borderBottom: "1px solid #27272a",
        padding: "3rem 2rem 2rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.15), transparent)",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.3em", color: "#71717a", marginBottom: "0.5rem", fontFamily: "monospace" }}>
            文部科学省 学習指導要領（平成29年告示）× 発達課題
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 900, letterSpacing: "0.05em" }}>
            <span style={{ color: "#a78bfa" }}>小学校</span>教育ゲーム計画書
          </h1>
          <div style={{ marginTop: "0.75rem", fontSize: "1.1rem", color: "#a1a1aa" }}>
            学習指導要領 × 発達心理学 × ゲームデザイン統合ドキュメント
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{
        display: "flex", borderBottom: "1px solid #27272a",
        background: "#0f0f11", overflowX: "auto",
      }}>
        {[
          { id: "overview", label: "📋 概要" },
          { id: "curriculum", label: "📚 学習指導要領" },
          { id: "dev", label: "🧠 発達課題" },
          { id: "game", label: "🎮 ゲーム計画書" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "0.875rem 1.5rem",
            background: "none", border: "none",
            borderBottom: activeTab === tab.id ? "2px solid #a78bfa" : "2px solid transparent",
            color: activeTab === tab.id ? "#a78bfa" : "#71717a",
            cursor: "pointer", whiteSpace: "nowrap",
            fontSize: "0.875rem", fontFamily: "inherit",
            transition: "all 0.2s",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <Section title="ドキュメント概要">
              <p style={{ color: "#a1a1aa", lineHeight: 1.8 }}>
                本書は文部科学省「小学校学習指導要領（平成29年告示）」の学年別・教科別学習目標と、
                エリクソン・ピアジェ・ハヴィガーストによる発達課題理論を組み合わせ、
                小学校全学年を対象とした教育ゲームの計画書を策定したものです。
              </p>
            </Section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
              {[
                { label: "対象学年", value: "小学校1〜6年生", icon: "🎓" },
                { label: "教科数", value: "14教科（学年別）", icon: "📖" },
                { label: "発達段階", value: "3フェーズ（低・中・高）", icon: "🧩" },
                { label: "ゲームコース", value: "3コース＋横断要素", icon: "🎮" },
              ].map(c => (
                <div key={c.label} style={{
                  background: "#18181b", border: "1px solid #27272a",
                  borderRadius: "0.75rem", padding: "1.25rem",
                }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{c.icon}</div>
                  <div style={{ fontSize: "0.75rem", color: "#71717a", marginBottom: "0.25rem" }}>{c.label}</div>
                  <div style={{ fontWeight: 700, color: "#e4e4e7" }}>{c.value}</div>
                </div>
              ))}
            </div>

            <Section title="構成フレームワーク" style={{ marginTop: "2rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                {[
                  { title: "学習指導要領", items: ["学年別学習目標", "教科別要件", "授業時数・内容"], color: "#4ade80" },
                  { title: "発達課題", items: ["ピアジェ認知発達", "エリクソン心理社会", "ハヴィガースト課題"], color: "#60a5fa" },
                  { title: "ゲームデザイン", items: ["コース設計", "メカニクス設計", "評価・フィードバック"], color: "#f472b6" },
                ].map(f => (
                  <div key={f.title} style={{
                    background: "#0f0f11", border: `1px solid ${f.color}33`,
                    borderRadius: "0.75rem", padding: "1rem",
                  }}>
                    <div style={{ fontWeight: 700, color: f.color, marginBottom: "0.75rem", fontSize: "0.875rem" }}>{f.title}</div>
                    {f.items.map(i => (
                      <div key={i} style={{ fontSize: "0.8rem", color: "#a1a1aa", padding: "0.25rem 0", borderTop: "1px solid #27272a" }}>
                        {i}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* CURRICULUM TAB */}
        {activeTab === "curriculum" && (
          <div>
            <Section title="学習指導要領（平成29年告示）学年別マトリクス">
              <p style={{ color: "#71717a", fontSize: "0.875rem" }}>
                低学年（1-2年）・中学年（3-4年）・高学年（5-6年）の3段階で整理。各科目の目標と主な要件を示す。
              </p>
            </Section>

            {/* Grade selector */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              {grades.map(([key, g]) => (
                <button key={key} onClick={() => { setExpandedGrade(key); setExpandedSubject(null); }} style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "999px",
                  border: `1px solid ${expandedGrade === key ? g.color : "#27272a"}`,
                  background: expandedGrade === key ? `${g.color}22` : "transparent",
                  color: expandedGrade === key ? g.color : "#71717a",
                  cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem",
                  transition: "all 0.2s",
                }}>
                  {g.label} ({g.grades})
                </button>
              ))}
            </div>

            {grades.map(([key, g]) => expandedGrade === key && (
              <div key={key}>
                {/* Grade header */}
                <div style={{
                  background: g.bg, border: `1px solid ${g.color}44`,
                  borderRadius: "0.75rem", padding: "1.25rem 1.5rem",
                  marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem", color: g.color }}>{g.label}：{g.grades}</div>
                    <div style={{ fontSize: "0.8rem", color: "#71717a" }}>{g.age} ／ {g.piaget} ／ {g.erikson}</div>
                  </div>
                </div>

                {/* Subjects */}
                {g.subjects.map(sub => (
                  <div key={sub.name} style={{
                    background: "#18181b", border: "1px solid #27272a",
                    borderRadius: "0.5rem", marginBottom: "0.5rem", overflow: "hidden",
                  }}>
                    <button
                      onClick={() => setExpandedSubject(expandedSubject === `${key}-${sub.name}` ? null : `${key}-${sub.name}`)}
                      style={{
                        width: "100%", textAlign: "left", padding: "0.875rem 1.25rem",
                        background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        color: "#e4e4e7", fontFamily: "inherit",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{
                          background: `${g.color}22`, color: g.color,
                          borderRadius: "0.25rem", padding: "0.125rem 0.5rem",
                          fontSize: "0.75rem", fontWeight: 700,
                        }}>{sub.name}</span>
                      </div>
                      <span style={{ color: "#71717a", fontSize: "0.75rem" }}>
                        {expandedSubject === `${key}-${sub.name}` ? "▲" : "▼"}
                      </span>
                    </button>
                    {expandedSubject === `${key}-${sub.name}` && (
                      <div style={{ padding: "0 1.25rem 1rem", borderTop: "1px solid #27272a" }}>
                        <div style={{ marginTop: "0.75rem" }}>
                          <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", color: "#71717a", marginBottom: "0.25rem" }}>学習目標</div>
                          <div style={{ fontSize: "0.875rem", color: "#d4d4d8", lineHeight: 1.7 }}>{sub.goals}</div>
                        </div>
                        <div style={{ marginTop: "0.75rem" }}>
                          <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", color: "#71717a", marginBottom: "0.25rem" }}>主な要件</div>
                          <div style={{ fontSize: "0.875rem", color: "#d4d4d8", lineHeight: 1.7 }}>{sub.requirements}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* DEVELOPMENT TAB */}
        {activeTab === "dev" && (
          <div>
            <Section title="発達課題マップ">
              <p style={{ color: "#71717a", fontSize: "0.875rem" }}>
                ピアジェ（認知発達段階）・エリクソン（心理社会的発達）・ハヴィガースト（発達課題）を統合した3段階モデル
              </p>
            </Section>

            {grades.map(([key, g]) => (
              <div key={key} style={{
                background: g.bg, border: `1px solid ${g.color}44`,
                borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "1.25rem",
              }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start" }}>
                  <div style={{ flex: "1", minWidth: "200px" }}>
                    <div style={{ fontWeight: 700, color: g.color, fontSize: "1rem", marginBottom: "0.25rem" }}>
                      {g.label}（{g.grades} / {g.age}）
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#71717a", marginBottom: "0.5rem" }}>
                      🧠 {g.piaget}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#71717a" }}>
                      💭 {g.erikson}
                    </div>
                  </div>
                  <div style={{ flex: "2", minWidth: "280px" }}>
                    <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", color: "#71717a", marginBottom: "0.5rem" }}>発達課題</div>
                    {g.devTasks.map((t, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: "0.5rem",
                        marginBottom: "0.4rem",
                      }}>
                        <span style={{ color: g.color, flexShrink: 0 }}>◆</span>
                        <span style={{ fontSize: "0.85rem", color: "#d4d4d8", lineHeight: 1.5 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Cross-cutting insight */}
            <div style={{
              background: "#18181b", border: "1px solid #a78bfa44",
              borderRadius: "0.75rem", padding: "1.25rem", marginTop: "0.5rem",
            }}>
              <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "0.75rem" }}>発達課題とゲームデザインの接点</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                {[
                  { phase: "低学年", insight: "ルール＆成功体験の即時フィードバック設計が重要。失敗を恥じない設計で勤勉性を育む。" },
                  { phase: "中学年", insight: "チームプレイ・競争・役割分担で社会的比較欲求に応える。因果関係の可視化が鍵。" },
                  { phase: "高学年", insight: "選択と結果の複雑さ、アイデンティティ探索を促す物語分岐と仮説思考型ゲームプレイ。" },
                ].map(d => (
                  <div key={d.phase} style={{ background: "#0f0f11", borderRadius: "0.5rem", padding: "0.875rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a78bfa", marginBottom: "0.375rem" }}>{d.phase}</div>
                    <div style={{ fontSize: "0.8rem", color: "#a1a1aa", lineHeight: 1.6 }}>{d.insight}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GAME PLAN TAB */}
        {activeTab === "game" && (
          <div>
            {/* Game title */}
            <div style={{
              textAlign: "center", padding: "2rem 1rem",
              background: "linear-gradient(135deg, #1a0533, #0a1628, #001a0a)",
              borderRadius: "1rem", border: "1px solid #27272a",
              marginBottom: "2rem", position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(167,139,250,0.1), transparent)",
              }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: "0.7rem", letterSpacing: "0.3em", color: "#71717a", marginBottom: "0.5rem" }}>GAME TITLE</div>
                <div style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)", fontWeight: 900, color: "#a78bfa", letterSpacing: "0.1em" }}>
                  {GAME_PLAN.title}
                </div>
                <div style={{ fontSize: "1rem", color: "#71717a", marginTop: "0.25rem" }}>{GAME_PLAN.subtitle}</div>
                <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                  {[
                    { label: "対象", val: GAME_PLAN.target },
                    { label: "プラットフォーム", val: GAME_PLAN.platform },
                  ].map(m => (
                    <div key={m.label} style={{
                      background: "#ffffff11", borderRadius: "999px",
                      padding: "0.375rem 1rem", fontSize: "0.8rem",
                    }}>
                      <span style={{ color: "#71717a" }}>{m.label}：</span>
                      <span style={{ color: "#e4e4e7" }}>{m.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Section title="コンセプト">
              <p style={{ color: "#a1a1aa", lineHeight: 1.8, margin: 0 }}>{GAME_PLAN.concept}</p>
            </Section>

            <Section title="学年別コース設計">
              {GAME_PLAN.mechanics.map((m, i) => {
                const g = Object.values(CURRICULUM)[i];
                return (
                  <div key={m.grade} style={{
                    background: g.bg, border: `1px solid ${g.color}44`,
                    borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1rem",
                  }}>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "2rem" }}>{m.icon}</div>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div style={{ fontWeight: 700, color: g.color, marginBottom: "0.25rem" }}>
                          {m.grade}：{m.theme}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#d4d4d8", lineHeight: 1.7, marginBottom: "0.5rem" }}>
                          {m.desc}
                        </div>
                        <div style={{
                          fontSize: "0.75rem", color: g.color,
                          background: `${g.color}11`, borderRadius: "999px",
                          display: "inline-block", padding: "0.2rem 0.75rem",
                        }}>
                          発達課題対応：{m.devAlign}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Section>

            <Section title="横断的ゲーム要素">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                {GAME_PLAN.crossCutting.map(cc => (
                  <div key={cc.feature} style={{
                    background: "#18181b", border: "1px solid #27272a",
                    borderRadius: "0.75rem", padding: "1rem",
                  }}>
                    <div style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{cc.icon}</div>
                    <div style={{ fontWeight: 700, color: "#e4e4e7", marginBottom: "0.375rem", fontSize: "0.875rem" }}>{cc.feature}</div>
                    <div style={{ fontSize: "0.8rem", color: "#a1a1aa", lineHeight: 1.6 }}>{cc.desc}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="評価・測定設計">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[
                  {
                    title: "学習達成ログ",
                    items: [
                      "教科別スキルツリー（指導要領準拠）",
                      "単元ごとの達成フラグ",
                      "誤答パターンの蓄積と弱点提示",
                    ],
                    color: "#4ade80",
                  },
                  {
                    title: "発達課題スコア",
                    items: [
                      "協力度・競争度・創造度・思考度の4軸",
                      "プレイスタイル分析（型の提示）",
                      "保護者向けレポート出力",
                    ],
                    color: "#60a5fa",
                  },
                  {
                    title: "ゲーム内アダプティブ",
                    items: [
                      "正答率に応じた難易度自動調整",
                      "苦手分野への誘導クエスト生成",
                      "協調型・競争型の切り替え",
                    ],
                    color: "#f472b6",
                  },
                  {
                    title: "教師ダッシュボード",
                    items: [
                      "クラス全体の学習進捗可視化",
                      "指導要領単元との対応マップ",
                      "介入アラート（低進捗児童）",
                    ],
                    color: "#a78bfa",
                  },
                ].map(e => (
                  <div key={e.title} style={{
                    background: "#18181b", border: `1px solid ${e.color}33`,
                    borderRadius: "0.75rem", padding: "1rem",
                  }}>
                    <div style={{ fontWeight: 700, color: e.color, marginBottom: "0.5rem", fontSize: "0.875rem" }}>{e.title}</div>
                    {e.items.map(it => (
                      <div key={it} style={{
                        fontSize: "0.8rem", color: "#a1a1aa", padding: "0.25rem 0",
                        borderTop: "1px solid #27272a", lineHeight: 1.5,
                      }}>• {it}</div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="開発フェーズ概要">
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: "7px", top: 0, bottom: 0,
                  width: "2px", background: "#27272a",
                }} />
                {[
                  { phase: "Phase 1", label: "低学年コース MVP", period: "〜3ヶ月", color: "#4ade80", items: ["国語・算数・生活教科の基礎ミニゲーム", "ひらがな入力・計算パズル・生き物観察", "保護者向けログ機能"] },
                  { phase: "Phase 2", label: "中学年コース + 協力プレイ", period: "〜6ヶ月", color: "#60a5fa", items: ["社会・理科・外国語活動の追加", "NPC協力・チーム役割分担メカニクス", "教師ダッシュボード初期版"] },
                  { phase: "Phase 3", label: "高学年コース + アダプティブ", period: "〜12ヶ月", color: "#f472b6", items: ["歴史・国際・家庭科コンテンツ", "AI難易度調整エンジン", "全学年統合・クラスルーム連携"] },
                ].map((p, i) => (
                  <div key={p.phase} style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", position: "relative" }}>
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "50%",
                      background: p.color, flexShrink: 0, marginTop: "0.2rem",
                      position: "relative", zIndex: 1,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: p.color, fontSize: "0.875rem" }}>{p.phase}</span>
                        <span style={{ color: "#e4e4e7", fontWeight: 700 }}>{p.label}</span>
                        <span style={{
                          fontSize: "0.7rem", background: `${p.color}22`,
                          color: p.color, borderRadius: "999px", padding: "0.1rem 0.5rem",
                        }}>{p.period}</span>
                      </div>
                      {p.items.map(it => (
                        <div key={it} style={{ fontSize: "0.8rem", color: "#a1a1aa", padding: "0.15rem 0" }}>• {it}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

      </div>

      <div style={{ textAlign: "center", padding: "2rem", color: "#3f3f46", fontSize: "0.75rem", borderTop: "1px solid #18181b" }}>
        文部科学省 小学校学習指導要領（平成29年告示）準拠 ／ 発達課題統合ゲーム計画書
      </div>
    </div>
  );
}

function Section({ title, children, style = {} }) {
  return (
    <div style={{ marginBottom: "2rem", ...style }}>
      <div style={{
        fontSize: "0.7rem", letterSpacing: "0.2em", color: "#71717a",
        marginBottom: "0.5rem", textTransform: "uppercase",
      }}>── {title}</div>
      {children}
    </div>
  );
}
