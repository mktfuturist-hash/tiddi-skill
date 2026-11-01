// 스크린샷 짝 찾기 + 같은 사진 여러 벌 찾기. 실제 비교는 scripts/pairs.ps1(윈도우 .NET)이 하고, 여기선 실행 · 진행 상황 · 결과 저장을 맡아요.
// 읽기만 해요. 이 파일에는 내 파일을 지우거나 옮기는 코드가 없어요.
import { spawn } from "node:child_process";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DupFile, DupGroup, PairShot, PairsResult, PairsStatus } from "@/lib/pair-types";
import { isRecent, type TrashItem } from "@/lib/trash-types";
import { listDrives } from "./drives";
import { gonePaths } from "./history";

const DATA = path.join(process.cwd(), "data");
const RAW = path.join(DATA, "pairs-raw.tsv");
const RESULT = path.join(DATA, "pairs.json");
const SCRIPT = path.join(process.cwd(), "scripts", "pairs.ps1");

type State = Omit<PairsStatus, "result"> & { result?: PairsResult | null; allowed?: Set<string> };

const g = globalThis as unknown as { __tiddiPairs?: State };
const state: State = (g.__tiddiPairs ??= {
  status: "idle",
  progress: { stage: "", count: "", current: "" },
  startedAt: null,
  error: null,
});

async function loadResult(): Promise<PairsResult | null> {
  if (state.result !== undefined) return state.result;
  try {
    remember(JSON.parse(await fsp.readFile(RESULT, "utf8")) as PairsResult);
  } catch {
    state.result = null;
  }
  return state.result ?? null;
}

// 썸네일로 보여 줘도 되는 파일 = 짝 찾기 결과에 들어 있는 사진뿐
function remember(result: PairsResult) {
  state.result = result;
  const allowed = new Set<string>();
  for (const s of [...result.pairs, ...result.uniques]) {
    allowed.add(s.path.toLowerCase());
    if (s.copy) allowed.add(s.copy.path.toLowerCase());
  }
  for (const grp of result.dupes ?? []) for (const f of grp.files) allowed.add(f.path.toLowerCase());
  state.allowed = allowed;
}

export async function currentPairs(): Promise<PairsResult | null> {
  return loadResult();
}

async function save(result: PairsResult) {
  await fsp.writeFile(RESULT, JSON.stringify(result));
  remember(result);
}

// 휴지통으로 보낸 스크린샷을 결과에서 빼요 (같은 사진 여러 벌은 지운 기록으로 걸러요)
export async function markGone(paths: string[]) {
  const result = await loadResult();
  if (!result) return;
  const gone = new Set(paths.map((p) => p.toLowerCase()));
  await save({
    ...result,
    pairs: result.pairs.filter((s) => !gone.has(s.path.toLowerCase())),
    uniques: result.uniques.filter((s) => !gone.has(s.path.toLowerCase())),
  });
}

// 되살린 스크린샷을 결과에 다시 넣어요
export async function markBack(items: TrashItem[]) {
  const result = await loadResult();
  const shots = items.filter((s) => s.kind === "pair" || s.kind === "unique");
  if (!result || shots.length === 0) return;
  const known = new Set([...result.pairs, ...result.uniques].map((s) => s.path.toLowerCase()));
  const back: PairShot[] = shots
    .filter((s) => !known.has(s.path.toLowerCase()))
    .map((s) => ({ path: s.path, name: s.name, folder: s.folder, size: s.size, time: s.time, month: s.month ?? monthOf(s.time), copy: s.copy }));
  const newest = (a: PairShot, b: PairShot) => b.time.localeCompare(a.time);
  await save({
    ...result,
    pairs: [...result.pairs, ...back.filter((s) => s.copy)].sort(newest),
    uniques: [...result.uniques, ...back.filter((s) => !s.copy)].sort(newest),
  });
}

export async function isKnownPicture(file: string): Promise<boolean> {
  await loadResult();
  return state.allowed?.has(file.toLowerCase()) ?? false;
}

// 남길 파일 고르기: 프로젝트 안 → 다운로드 · 카톡 받은 파일 밖 → 가장 오래된 것 → 경로가 짧은 것
function chooseKeep(files: DupFile[]): string {
  const rank = (f: DupFile) => [f.project ? 0 : 1, /\\downloads\\|카카오톡 받은 파일/i.test(f.path) ? 1 : 0, Date.parse(f.time), f.path.length];
  const sorted = [...files].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });
  return sorted[0].path;
}

// 지금 화면에 보여 줄 같은 사진 여러 벌 (휴지통에 간 파일은 빼고, 남은 게 2개 이상인 묶음만)
function liveDupes(groups: DupGroup[], gone: Set<string>, now: number): DupGroup[] {
  const out: DupGroup[] = [];
  for (const grp of groups) {
    const files = grp.files.filter((f) => !gone.has(f.path.toLowerCase())).map((f) => ({ ...f, recent: isRecent(f, now) }));
    if (files.length < 2 || files.every((f) => f.project)) continue;
    const keep = files.some((f) => f.path === grp.keep) ? grp.keep : chooseKeep(files);
    out.push({ ...grp, files, keep });
  }
  return out;
}

export async function getPairs(): Promise<PairsStatus> {
  const saved = await loadResult();
  const now = Date.now();
  const gone = await gonePaths();
  const mark = (s: PairShot) => ({ ...s, recent: isRecent(s, now) });
  const result = saved
    ? { ...saved, pairs: saved.pairs.map(mark), uniques: saved.uniques.map(mark), dupes: liveDupes(saved.dupes ?? [], gone, now) }
    : null;
  return { status: state.status, progress: state.progress, startedAt: state.startedAt, error: state.error, result };
}

export async function startPairs(): Promise<void> {
  if (state.status === "running") return;
  state.status = "running";
  state.progress = { stage: "시작하는 중", count: "", current: "" };
  state.startedAt = Date.now();
  state.error = null;
  await fsp.mkdir(DATA, { recursive: true });
  // 휴지통을 믿을 수 있는 자료 드라이브(D 등)의 사진도 같이 봐요
  const extra = (await listDrives())
    .filter((d) => !d.system && d.manage)
    .map((d) => d.root)
    .join("|");

  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, "-UserHome", os.homedir(), "-Out", RAW, "-OneDrive", process.env.OneDrive ?? "", "-ExtraRoots", extra],
    { windowsHide: true },
  );

  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const [kind, stage, count, current] = line.split("\t");
      if (kind === "G") state.progress = { stage: stage ?? "", count: count ?? "", current: current ?? "" };
    }
  });

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  child.on("error", (e) => {
    state.status = "error";
    state.error = `짝 찾기를 시작하지 못했어요: ${e.message}`;
  });

  child.on("close", async (code) => {
    if (state.status !== "running") return;
    try {
      if (code !== 0) throw new Error(stderr.trim().slice(0, 300) || `종료 코드 ${code}`);
      const result = await buildResult(Date.now() - (state.startedAt ?? Date.now()));
      await fsp.writeFile(RESULT, JSON.stringify(result));
      remember(result);
      state.status = "idle";
    } catch (e) {
      state.status = "error";
      state.error = e instanceof Error ? e.message : String(e);
    }
  });
}

export function short(full: string, home: string) {
  const dir = path.win32.dirname(full);
  return dir.toLowerCase().startsWith(`${home.toLowerCase()}\\`) ? dir.slice(home.length + 1) : dir;
}

export function monthOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function buildResult(durationMs: number): Promise<PairsResult> {
  const text = await fsp.readFile(RAW, "utf8");
  const home = os.homedir();
  const pairs: PairShot[] = [];
  const uniques: PairShot[] = [];
  const dupMap = new Map<string, DupFile[]>();
  let screenshots = "";
  let shotCount = 0;
  let scanned = 0;

  const shot = (p: string, size: string, time: string): PairShot => ({
    path: p,
    name: path.win32.basename(p),
    folder: short(p, home),
    size: Number(size),
    time,
    month: monthOf(time),
  });

  for (const line of text.split(/\r?\n/)) {
    const f = line.split("\t");
    if (f[0] === "K" && f[1] === "screenshots") screenshots = f[2];
    else if (f[0] === "P") {
      pairs.push({
        ...shot(f[1], f[2], f[3]),
        copy: { path: f[4], name: path.win32.basename(f[4]), folder: short(f[4], home), size: Number(f[5]), similarity: Math.round(100 - (Number(f[6]) * 100) / 64) },
      });
    } else if (f[0] === "U") uniques.push(shot(f[1], f[2], f[3]));
    else if (f[0] === "D") {
      const list = dupMap.get(f[1]) ?? [];
      list.push({ path: f[2], name: path.win32.basename(f[2]), folder: short(f[2], home), size: Number(f[3]), time: f[4], project: f[5] === "1" });
      dupMap.set(f[1], list);
    } else if (f[0] === "S") {
      shotCount = Number(f[1]);
      scanned = Number(f[2]);
    }
  }

  const dupes: DupGroup[] = [];
  for (const [id, files] of dupMap) {
    if (files.length < 2 || files.every((x) => x.project)) continue;
    const folders = new Set(files.map((x) => x.folder.toLowerCase()));
    dupes.push({ id, size: files[0].size, files, keep: chooseKeep(files), sameFolder: folders.size === 1 });
  }
  // 비울 수 있는 용량이 큰 묶음부터
  dupes.sort((a, b) => b.size * (b.files.length - 1) - a.size * (a.files.length - 1));

  const newest = (a: PairShot, b: PairShot) => b.time.localeCompare(a.time);
  pairs.sort(newest);
  uniques.sort(newest);
  return { foundAt: Date.now(), durationMs, screenshots, shotCount, scanned, pairs, uniques, dupes };
}
