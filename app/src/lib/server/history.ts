// 지운 기록 (data/history.json). 휴지통에 들어 있는 파일 목록이기도 해요
import { promises as fsp } from "node:fs";
import path from "node:path";
import type { HistoryEntry } from "@/lib/trash-types";

const DATA = path.join(process.cwd(), "data");
const HISTORY = path.join(DATA, "history.json");

export async function readHistory(): Promise<HistoryEntry[]> {
  let text: string;
  try {
    text = await fsp.readFile(HISTORY, "utf8");
  } catch {
    return [];
  }
  try {
    const list = JSON.parse(text);
    if (!Array.isArray(list)) throw new Error("목록이 아니에요");
    // 예전 기록에는 종류가 없어서 채워 줘요
    return (list as HistoryEntry[]).map((h) => ({ ...h, items: h.items.map((s) => ({ ...s, kind: s.kind ?? (s.copy ? "pair" : "unique") })) }));
  } catch {
    // 기록 파일이 깨졌으면 빈 목록으로 덮어쓰지 않고, 따로 옮겨 둔 뒤 알려요
    const kept = path.join(DATA, `history-broken-${Date.now()}.json`);
    await fsp.rename(HISTORY, kept);
    throw new Error(`지운 기록 파일이 깨져 있어서 ${path.basename(kept)}로 옮겨 뒀어요. 윈도우 휴지통에서는 그대로 되살릴 수 있어요`);
  }
}

export async function writeHistory(list: HistoryEntry[]) {
  await fsp.mkdir(DATA, { recursive: true });
  await fsp.writeFile(HISTORY, JSON.stringify(list));
}

// 지금 휴지통에 들어 있는(지운 기록에 남은) 파일 경로들
export async function gonePaths(): Promise<Set<string>> {
  try {
    const list = await readHistory();
    return new Set(list.flatMap((h) => h.items.map((s) => s.path.toLowerCase())));
  } catch {
    return new Set();
  }
}
