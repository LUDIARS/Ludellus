import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface MockupManifest {
  id: string;
  title: string;
  description?: string;
  entry: string;       // mockup フォルダからの相対パス (例: "index.html")
  tags?: string[];
}

/**
 * renderer/mockups/<id>/manifest.json を列挙する。
 * Claude Web で書き出した HTML/JS をそのフォルダに置くだけで読み込めるようにする方針。
 */
export class MockupRegistry {
  constructor(private readonly root: string) {}

  list(): MockupManifest[] {
    let entries: string[];
    try {
      entries = readdirSync(this.root);
    } catch {
      return [];
    }

    const out: MockupManifest[] = [];
    for (const name of entries) {
      const full = join(this.root, name);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;

      const manifestPath = join(full, "manifest.json");
      try {
        const raw = readFileSync(manifestPath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<MockupManifest>;
        if (!parsed.id || !parsed.title || !parsed.entry) continue;
        out.push({
          id: parsed.id,
          title: parsed.title,
          description: parsed.description,
          entry: parsed.entry,
          tags: parsed.tags ?? [],
        });
      } catch {
        // manifest が無い・壊れているフォルダはスキップ
      }
    }
    return out;
  }
}
