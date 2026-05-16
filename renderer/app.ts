// Foundation UI ベースの軽量 renderer。 monitor のメトリクスを top bar に表示し、
// mockup 一覧をサイドバー → iframe に流すだけのシンプル構成。

interface InputMetric {
  windowStart: number;
  windowEnd: number;
  keyPresses: number;
  mouseClicks: number;
  mouseMoves: number;
  mouseTravelPx: number;
  idleMs: number;
}

interface MockupManifest {
  id: string;
  title: string;
  description?: string;
  entry: string;
  tags?: string[];
}

declare global {
  interface Window {
    ludellus: {
      listMockups: () => Promise<MockupManifest[]>;
      startMonitor: () => Promise<{ ok: boolean; reason?: string }>;
      stopMonitor: () => Promise<void>;
      snapshotMonitor: () => Promise<InputMetric>;
      onMetric: (cb: (m: InputMetric) => void) => () => void;
    };
  }
}

const metricEl = document.getElementById("metric") as HTMLDivElement;
const listEl = document.getElementById("mockupList") as HTMLUListElement;
const frame = document.getElementById("mockupFrame") as HTMLIFrameElement;
const btnStart = document.getElementById("btnStart") as HTMLButtonElement;
const btnStop = document.getElementById("btnStop") as HTMLButtonElement;

async function refreshList(): Promise<void> {
  const items = await window.ludellus.listMockups();
  listEl.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "renderer/mockups/ にモックアップを置いてください";
    listEl.appendChild(li);
    return;
  }
  for (const m of items) {
    const li = document.createElement("li");
    li.className = "mockup-item";
    li.tabIndex = 0;
    li.innerHTML = `<strong>${escapeHtml(m.title)}</strong><span class="desc">${escapeHtml(m.description ?? "")}</span>`;
    li.addEventListener("click", () => loadMockup(m));
    listEl.appendChild(li);
  }
}

function loadMockup(m: MockupManifest): void {
  frame.src = `mockups/${m.id}/${m.entry}`;
  document.querySelectorAll(".mockup-item.active").forEach((el) => el.classList.remove("active"));
  const target = Array.from(listEl.querySelectorAll(".mockup-item")).find((el) =>
    el.querySelector("strong")?.textContent === m.title,
  );
  target?.classList.add("active");
}

function renderMetric(m: InputMetric | null): void {
  if (!m) {
    metricEl.textContent = "入力監視: 停止中";
    return;
  }
  const sec = Math.max(1, Math.round((m.windowEnd - m.windowStart) / 1000));
  metricEl.textContent =
    `入力監視: ⌨ ${m.keyPresses} / 🖱 ${m.mouseClicks} click ${m.mouseMoves} mv (${Math.round(m.mouseTravelPx)}px) ` +
    `/ idle ${Math.round(m.idleMs / 100) / 10}s in ${sec}s`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

btnStart.addEventListener("click", async () => {
  const res = await window.ludellus.startMonitor();
  if (!res.ok) {
    metricEl.textContent = `入力監視: 起動失敗 — ${res.reason ?? "unknown"}`;
    return;
  }
  btnStart.disabled = true;
  btnStop.disabled = false;
});

btnStop.addEventListener("click", async () => {
  await window.ludellus.stopMonitor();
  btnStart.disabled = false;
  btnStop.disabled = true;
  renderMetric(null);
});

window.ludellus.onMetric(renderMetric);
refreshList();
