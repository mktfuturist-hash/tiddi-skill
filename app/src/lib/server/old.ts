// 오래된 파일 찾기. 드라이브 훑기 때 모아 둔 목록(data/files.json)에서 조건에 맞는 것만 골라요. 읽기만 해요
import { promises as fsp } from "node:fs";
import { letterOf } from "@/lib/drive-types";
import type { OldGroup } from "@/lib/file-kinds";
import { MONTH_MS, type OldFile, type OldQuery, type OldResult } from "@/lib/old-types";
import { listDrives } from "./drives";
import { gonePaths } from "./history";
import { FILES } from "./scan";

type Index = { scannedAt: number; files: OldFile[]; byPath: Map<string, OldFile>; mtime: number };

const g = globalThis as unknown as { __tiddiOld?: Index };

async function load(): Promise<Index | null> {
  let st;
  try {
    st = await fsp.stat(FILES);
  } catch {
    return null;
  }
  if (g.__tiddiOld && g.__tiddiOld.mtime === st.mtimeMs) return g.__tiddiOld;
  try {
    const data = JSON.parse(await fsp.readFile(FILES, "utf8")) as { scannedAt: number; files: OldFile[] };
    // 예전 목록에는 드라이브 글자가 없어서 경로에서 채워요
    const files = data.files.map((f) => ({ ...f, drive: f.drive ?? letterOf(f.path) }));
    g.__tiddiOld = { scannedAt: data.scannedAt, files, byPath: new Map(files.map((f) => [f.path.toLowerCase(), f])), mtime: st.mtimeMs };
    return g.__tiddiOld;
  } catch {
    return null;
  }
}

export async function findOldFile(p: string): Promise<OldFile | null> {
  return (await load())?.byPath.get(p.toLowerCase()) ?? null;
}

export async function isOldPicture(p: string): Promise<boolean> {
  const f = await findOldFile(p);
  return !!f && f.group === "media";
}

const LIMIT = 400;

export async function queryOld(q: OldQuery): Promise<OldResult> {
  const [index, drives] = await Promise.all([load(), listDrives()]);
  const empty = () => ({ count: 0, bytes: 0 });
  const byGroup: Record<OldGroup, { count: number; bytes: number }> = { media: empty(), doc: empty(), install: empty(), etc: empty() };
  const binLimits = Object.fromEntries(drives.map((d) => [d.letter, d.binLimit]));
  if (!index) return { scannedAt: null, total: 0, bytes: 0, byGroup, byDrive: [], items: [], binLimits };

  const gone = await gonePaths();
  const before = Date.now() - q.months * MONTH_MS;
  const min = q.minMB * 1024 * 1024;
  const driveCount = new Map<string, { count: number; bytes: number }>();
  const matched: OldFile[] = [];
  for (const f of index.files) {
    if (f.size < min || Date.parse(f.time) > before || gone.has(f.path.toLowerCase())) continue;
    const dc = driveCount.get(f.drive) ?? empty();
    dc.count++;
    dc.bytes += f.size;
    driveCount.set(f.drive, dc);
    if (q.drive !== "all" && f.drive !== q.drive) continue;
    byGroup[f.group].count++;
    byGroup[f.group].bytes += f.size;
    if (q.group === "all" || q.group === f.group) matched.push(f);
  }
  matched.sort((a, b) => b.size - a.size);
  return {
    scannedAt: index.scannedAt,
    total: matched.length,
    bytes: matched.reduce((a, f) => a + f.size, 0),
    byGroup,
    byDrive: [...driveCount.entries()].map(([letter, v]) => ({ letter, ...v })).sort((a, b) => a.letter.localeCompare(b.letter)),
    items: matched.slice(0, LIMIT),
    binLimits,
  };
}
