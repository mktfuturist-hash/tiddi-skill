// C 드라이브 훑기. 실제로 훑는 일은 scripts/scan.ps1(윈도우 .NET)이 하고, 여기선 실행 · 진행 상황 · 결과 저장을 맡아요.
// 읽기만 해요. 이 파일에는 내 파일을 지우거나 옮기는 코드가 없어요.
import { spawn } from "node:child_process";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { groupOf } from "@/lib/file-kinds";
import type { OldFile } from "@/lib/old-types";
import type { DirKind, MapDir, ScanResult, ScanStatus, TypeKey } from "@/lib/scan-types";

const ROOT = "C:\\";
const DATA = path.join(process.cwd(), "data");
const RAW = path.join(DATA, "scan-raw.tsv");
const RESULT = path.join(DATA, "scan.json");
// 오래된 파일 후보 목록 (내 사용자 폴더의 1MB 이상 파일)
export const FILES = path.join(DATA, "files.json");
const SCRIPT = path.join(process.cwd(), "scripts", "scan.ps1");

// 지도에 남길 최소 크기 · 폴더마다 최대 칸 수 (나머지는 「기타 N개」로 묶어요)
const MIN_SIZE = 20 * 1024 ** 2;
const MAX_CHILDREN = 14;

type State = Omit<ScanStatus, "drive" | "result"> & { result?: ScanResult | null };

// 개발 서버가 코드를 다시 불러와도 진행 중인 훑기를 잃지 않게 전역에 둬요
const g = globalThis as unknown as { __tiddiScan?: State };
const state: State = (g.__tiddiScan ??= {
  status: "idle",
  progress: { files: 0, bytes: 0, current: "" },
  startedAt: null,
  error: null,
});

async function readDrive() {
  try {
    const s = await fsp.statfs(ROOT);
    return { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
  } catch {
    return { total: 0, free: 0 };
  }
}

async function loadResult(): Promise<ScanResult | null> {
  if (state.result !== undefined) return state.result;
  try {
    state.result = JSON.parse(await fsp.readFile(RESULT, "utf8")) as ScanResult;
  } catch {
    state.result = null;
  }
  return state.result;
}

export async function getScan(): Promise<ScanStatus> {
  const [drive, result] = await Promise.all([readDrive(), loadResult()]);
  return {
    status: state.status,
    progress: state.progress,
    startedAt: state.startedAt,
    error: state.error,
    drive,
    result,
  };
}

export async function startScan(): Promise<void> {
  if (state.status === "running") return;
  state.status = "running";
  state.progress = { files: 0, bytes: 0, current: "" };
  state.startedAt = Date.now();
  state.error = null;
  await fsp.mkdir(DATA, { recursive: true });

  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, "-Root", ROOT, "-Out", RAW, "-OneDrive", process.env.OneDrive ?? "", "-UserHome", os.homedir()],
    { windowsHide: true },
  );

  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const [kind, files, bytes, current] = line.split("\t");
      if (kind === "P") state.progress = { files: Number(files), bytes: Number(bytes), current: current ?? "" };
    }
  });

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  child.on("error", (e) => {
    state.status = "error";
    state.error = `훑기를 시작하지 못했어요: ${e.message}`;
  });

  child.on("close", async (code) => {
    if (state.status !== "running") return;
    try {
      if (code !== 0) throw new Error(stderr.trim().slice(0, 300) || `종료 코드 ${code}`);
      const result = await buildResult(Date.now() - (state.startedAt ?? Date.now()));
      await fsp.writeFile(RESULT, JSON.stringify(result));
      state.result = result;
      state.status = "idle";
    } catch (e) {
      state.status = "error";
      state.error = e instanceof Error ? e.message : String(e);
    }
  });
}

function lower(p: string) {
  return p.toLowerCase().replace(/\\+$/, "");
}

async function buildResult(durationMs: number): Promise<ScanResult> {
  const text = await fsp.readFile(RAW, "utf8");
  const home = os.homedir();
  const homeL = lower(home);
  const oneDriveL = process.env.OneDrive ? lower(process.env.OneDrive) : null;
  const types: Record<TypeKey, number> = { image: 0, video: 0, doc: 0, app: 0, dev: 0, archive: 0, etc: 0 };
  const dirs = new Map<string, MapDir>();
  let screenshots: string | null = null;
  let summary = { files: 0, bytes: 0, cloudBytes: 0, skipped: 0 };
  const olds: OldFile[] = [];

  const kindOf = (pl: string): DirKind | undefined => {
    if (screenshots && pl === lower(screenshots)) return "screenshots";
    if (oneDriveL && pl === oneDriveL) return "onedrive";
    if (pl === `${homeL}\\appdata`) return "appdata";
    if (pl === "c:\\$recycle.bin") return "recycle";
    if (["c:\\windows", "c:\\program files", "c:\\program files (x86)", "c:\\programdata"].includes(pl)) return "system";
    return undefined;
  };

  // 휴지통 버튼을 달 수 있는 곳: 내 사용자 폴더 안, AppData 밖
  const deletable = (pl: string) => pl.startsWith(`${homeL}\\`) && pl !== `${homeL}\\appdata` && !pl.startsWith(`${homeL}\\appdata\\`);
  // 내 폴더를 품고 있는 위쪽 폴더(C:\, Users, 내 폴더)는 자물쇠를 걸지 않아요. 들어가 볼 수 있어야 해요
  const holdsHome = (pl: string) => `${homeL}\\`.startsWith(`${pl}\\`) || pl === "c:";

  for (const line of text.split(/\r?\n/)) {
    const p = line.split("\t");
    if (p[0] === "K" && p[1] === "screenshots") screenshots = p[2] || null;
    else if (p[0] === "T" && p[1] in types) types[p[1] as TypeKey] = Number(p[2]);
    else if (p[0] === "F") {
      const full = p[3];
      const dir = path.win32.dirname(full);
      olds.push({
        path: full,
        name: path.win32.basename(full),
        folder: dir.toLowerCase().startsWith(`${homeL}\\`) ? dir.slice(home.length + 1) : dir,
        size: Number(p[1]),
        time: p[2],
        group: groupOf(full),
      });
    } else if (p[0] === "S") summary = { files: Number(p[1]), bytes: Number(p[2]), cloudBytes: Number(p[4]), skipped: Number(p[5]) };
    else if (p[0] === "D") {
      const full = p[4];
      const pl = lower(full);
      dirs.set(pl, {
        name: Number(p[1]) === 0 ? "C 드라이브" : path.win32.basename(full),
        path: full,
        size: Number(p[2]),
        files: Number(p[3]),
        locked: !deletable(pl) && !holdsHome(pl),
        kind: undefined,
        own: 0,
      });
    }
  }

  for (const [pl, node] of dirs) {
    node.kind = kindOf(pl);
    const parent = lower(path.win32.dirname(node.path));
    if (parent !== pl && dirs.has(parent)) {
      const up = dirs.get(parent)!;
      (up.children ??= []).push(node);
    }
  }

  await fsp.writeFile(FILES, JSON.stringify({ scannedAt: Date.now(), files: olds }));

  const tree = dirs.get("c:");
  if (!tree) throw new Error("훑은 결과에 C 드라이브가 없어요");
  prune(tree);

  return { scannedAt: Date.now(), durationMs, ...summary, home, screenshots, tree, types };
}

function prune(node: MapDir) {
  const kids = (node.children ?? []).filter((k) => k.size > 0).sort((a, b) => b.size - a.size);
  let keep = 0;
  while (keep < kids.length && keep < MAX_CHILDREN && kids[keep].size >= MIN_SIZE) keep++;
  const rest = kids.slice(keep);
  node.children = keep ? kids.slice(0, keep) : undefined;
  node.rest = rest.length ? { count: rest.length, size: rest.reduce((a, k) => a + k.size, 0) } : undefined;
  const counted = kids.reduce((a, k) => a + k.size, 0);
  node.own = Math.max(0, node.size - counted);
  node.children?.forEach(prune);
}
