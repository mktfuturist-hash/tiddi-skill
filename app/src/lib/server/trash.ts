// 휴지통 보내기 · 되살리기 · 지운 기록.
// 영구 삭제는 없어요. 실제로 옮기는 일은 scripts/trash.ps1(윈도우 휴지통으로만)과 scripts/restore.ps1(휴지통의 「복원」)이 해요.
import { spawn } from "node:child_process";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { letterOf } from "@/lib/drive-types";
import { RECON } from "@/lib/mode";
import { MONTH_MS, OLD_MIN_MONTHS } from "@/lib/old-types";
import type { DupFile } from "@/lib/pair-types";
import { RECENT_MS, type HistoryEntry, type Refused, type TrashItem } from "@/lib/trash-types";
import { forgetDrives, listDrives, placeProblem } from "./drives";
import { gonePaths, readHistory, writeHistory } from "./history";
import { getSettings } from "./settings";
import { findOldFile } from "./old";
import { currentPairs, markBack, markGone, monthOf } from "./pairs";

const DATA = path.join(process.cwd(), "data");
const SCRIPTS = path.join(process.cwd(), "scripts");

const MAX_FILES = 5000;

// 한 번에 하나씩만 해요 (보내는 중에 또 보내지 않게)
const g = globalThis as unknown as { __tiddiTrashBusy?: boolean };

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    return (await readHistory()).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

function runScript(name: string, list: string[]): Promise<Map<string, string | null>> {
  return new Promise((resolve, reject) => {
    const listFile = path.join(DATA, `${name}-list.txt`);
    const outFile = path.join(DATA, `${name}-out.txt`);
    fsp
      .writeFile(listFile, list.join("\r\n"), "utf8")
      .then(() => {
        const child = spawn(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(SCRIPTS, `${name}.ps1`), "-List", listFile, "-Out", outFile],
          { windowsHide: true },
        );
        let stderr = "";
        child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
        child.on("error", reject);
        child.on("close", async (code) => {
          try {
            if (code !== 0) throw new Error(stderr.trim().slice(0, 300) || `종료 코드 ${code}`);
            // 결과: 경로 → null(성공) 또는 실패 이유
            const results = new Map<string, string | null>();
            for (const line of (await fsp.readFile(outFile, "utf8")).split(/\r?\n/)) {
              const [kind, p, why] = line.split("\t");
              if (kind === "OK") results.set(p.toLowerCase(), null);
              else if (kind === "ERR") results.set(p.toLowerCase(), why || "알 수 없는 이유");
            }
            resolve(results);
          } catch (e) {
            reject(e);
          }
        });
      })
      .catch(reject);
  });
}

async function stat(p: string) {
  return fsp.stat(p).catch(() => null);
}

export async function sendToTrash(paths: unknown): Promise<{ entry: HistoryEntry | null; refused: Refused[] }> {
  if (!Array.isArray(paths) || paths.length === 0 || !paths.every((p) => typeof p === "string")) throw new Error("보낼 파일이 없어요");
  if (paths.length > MAX_FILES) throw new Error(`한 번에 ${MAX_FILES}개까지만 보낼 수 있어요`);
  // 정찰 모드에서는 화면뿐 아니라 서버도 아무것도 보내지 않아요
  if (RECON) throw new Error("정찰 모드라 아직 보내지 않아요. 짝을 확인한 뒤 TIDDI 스킬에 정찰 모드를 풀어 달라고 해 주세요");
  if (g.__tiddiTrashBusy) throw new Error("다른 작업을 하는 중이에요. 잠시 뒤에 다시 해 주세요");
  g.__tiddiTrashBusy = true;
  try {
    // 기록을 남길 수 있는지 먼저 확인해요. 못 남기면 아무것도 옮기지 않아요
    await readHistory();
    // 드라이브마다 휴지통을 믿을 수 있는지 · 얼마나 받아 줄 수 있는지 새로 읽어요
    const drives = await listDrives(true);
    // 최근 7일 보호 설정 (끄면 최근 파일도 보낼 수 있어요. 오래된 파일은 따로 6개월 규칙이 있어요)
    const { protectRecent } = await getSettings();
    const gone = await gonePaths();
    const pairsResult = await currentPairs();
    const shots = new Map((pairsResult ? [...pairsResult.pairs, ...pairsResult.uniques] : []).map((s) => [s.path.toLowerCase(), s]));
    const shotsDir = pairsResult ? `${pairsResult.screenshots.toLowerCase().replace(/\\+$/, "")}\\` : null;
    const dupIndex = new Map<string, { group: string; file: DupFile; members: DupFile[] }>();
    for (const grp of pairsResult?.dupes ?? []) {
      const members = grp.files.filter((f) => !gone.has(f.path.toLowerCase()));
      for (const f of members) dupIndex.set(f.path.toLowerCase(), { group: grp.id, file: f, members });
    }

    const ok: TrashItem[] = [];
    const refused: Refused[] = [];
    const refuse = (p: string, reason: string) => refused.push({ path: p, name: path.win32.basename(p), reason });
    const requested = new Set((paths as string[]).map((p) => p.toLowerCase()));
    const dupWanted = new Map<string, TrashItem[]>();

    for (const p of new Set(paths as string[])) {
      const key = p.toLowerCase();
      if (gone.has(key)) {
        refuse(p, "이미 휴지통에 있어요");
        continue;
      }
      // 휴지통을 믿을 수 있는 드라이브인지, 그 드라이브에서 보내도 되는 자리인지
      const where = placeProblem(p, drives);
      if (where) {
        refuse(p, where);
        continue;
      }
      const st = await stat(p);
      if (!st || !st.isFile()) {
        refuse(p, "파일이 없어요");
        continue;
      }
      if (protectRecent && Date.now() - st.mtimeMs < RECENT_MS) {
        refuse(p, "최근 7일 안에 만든 파일이라 보호 중이에요");
        continue;
      }

      // ① 스크린샷 (짝 있음 · 유일본)
      const shot = shots.get(key);
      if (shot && shotsDir && key.startsWith(shotsDir)) {
        if (st.size !== shot.size) {
          refuse(p, "찾은 뒤에 파일이 바뀌었어요. 짝을 다시 찾아 주세요");
          continue;
        }
        if (shot.copy && !(await stat(shot.copy.path))) {
          refuse(p, "사본이 없어졌어요. 짝을 다시 찾아 주세요");
          continue;
        }
        ok.push({ path: shot.path, name: shot.name, folder: shot.folder, size: shot.size, time: shot.time, month: shot.month, kind: shot.copy ? "pair" : "unique", copy: shot.copy });
        continue;
      }

      // ② 같은 사진 여러 벌 (묶음 확인은 아래에서 한꺼번에)
      const dup = dupIndex.get(key);
      if (dup) {
        if (dup.file.project) {
          refuse(p, "개발 프로젝트 안의 파일은 지우지 않아요");
          continue;
        }
        if (st.size !== dup.file.size) {
          refuse(p, "찾은 뒤에 파일이 바뀌었어요. 다시 찾아 주세요");
          continue;
        }
        const item: TrashItem = { path: dup.file.path, name: dup.file.name, folder: dup.file.folder, size: dup.file.size, time: dup.file.time, month: monthOf(dup.file.time), kind: "dup", group: dup.group };
        dupWanted.set(dup.group, [...(dupWanted.get(dup.group) ?? []), item]);
        continue;
      }

      // ③ 오래된 파일
      const old = await findOldFile(p);
      if (old) {
        if (st.size !== old.size || Math.abs(st.mtimeMs - Date.parse(old.time)) > 2000) {
          refuse(p, "훑은 뒤에 파일이 바뀌었어요. 다시 훑어 주세요");
          continue;
        }
        if (Date.now() - st.mtimeMs < OLD_MIN_MONTHS * MONTH_MS) {
          refuse(p, `${OLD_MIN_MONTHS}개월이 안 된 파일이에요`);
          continue;
        }
        ok.push({ path: old.path, name: old.name, folder: old.folder, size: old.size, time: old.time, month: monthOf(old.time), kind: "old" });
        continue;
      }

      refuse(p, "TIDDI가 찾은 목록에 없는 파일이에요");
    }

    // 같은 사진 여러 벌: 묶음마다 내용이 같은 파일이 하나 이상 꼭 남아야 해요
    for (const [groupId, items] of dupWanted) {
      const members = [...dupIndex.values()].find((d) => d.group === groupId)?.members ?? [];
      let survivors = 0;
      for (const m of members) {
        if (requested.has(m.path.toLowerCase())) continue;
        const st = await stat(m.path);
        if (st && st.isFile() && st.size === m.size) survivors++;
      }
      if (survivors === 0) for (const it of items) refuse(it.path, "같은 사진 묶음에 하나는 꼭 남겨야 해요");
      else ok.push(...items);
    }

    // 드라이브마다 그 드라이브 휴지통이 받아 줄 수 있는 만큼까지만 (넘으면 휴지통을 거치지 않고 지워질 수 있어요)
    const perDrive = new Map<string, number>();
    for (const s of ok) perDrive.set(letterOf(s.path), (perDrive.get(letterOf(s.path)) ?? 0) + s.size);
    for (const [letter, total] of perDrive) {
      const limit = drives.find((d) => d.letter === letter)?.binLimit ?? 0;
      if (total > limit) {
        throw new Error(`${letter} 드라이브 휴지통에 남은 자리(${Math.floor(limit / 1024 ** 2).toLocaleString("ko-KR")}MB)보다 커요. 나눠서 보내거나 윈도우 휴지통을 먼저 비워 주세요`);
      }
    }
    if (ok.length === 0) return { entry: null, refused };

    const results = await runScript("trash", ok.map((s) => s.path));
    forgetDrives();
    const moved = ok.filter((s) => results.get(s.path.toLowerCase()) === null);
    for (const s of ok) {
      const why = results.get(s.path.toLowerCase());
      if (why !== null) refuse(s.path, why ?? "결과를 받지 못했어요");
    }
    if (moved.length === 0) return { entry: null, refused };

    const entry: HistoryEntry = { id: Date.now().toString(36), at: Date.now(), items: moved, bytes: moved.reduce((a, s) => a + s.size, 0) };
    await writeHistory([...(await readHistory()), entry]);
    await markGone(moved.filter((s) => s.kind === "pair" || s.kind === "unique").map((s) => s.path));
    return { entry, refused };
  } finally {
    g.__tiddiTrashBusy = false;
  }
}

export async function restoreEntry(id: unknown): Promise<{ restored: number; refused: Refused[] }> {
  if (typeof id !== "string") throw new Error("되살릴 기록이 없어요");
  if (g.__tiddiTrashBusy) throw new Error("다른 작업을 하는 중이에요. 잠시 뒤에 다시 해 주세요");
  g.__tiddiTrashBusy = true;
  try {
    const history = await readHistory();
    const entry = history.find((h) => h.id === id);
    if (!entry) throw new Error("지운 기록을 찾지 못했어요");
    const results = await runScript("restore", entry.items.map((s) => s.path));
    const back = entry.items.filter((s) => results.get(s.path.toLowerCase()) === null);
    const left = entry.items.filter((s) => results.get(s.path.toLowerCase()) !== null);
    const refused: Refused[] = left.map((s) => ({ path: s.path, name: s.name, reason: results.get(s.path.toLowerCase()) ?? "결과를 받지 못했어요" }));
    const next = left.length
      ? history.map((h) => (h.id === id ? { ...h, items: left, bytes: left.reduce((a, s) => a + s.size, 0) } : h))
      : history.filter((h) => h.id !== id);
    await writeHistory(next);
    // 스크린샷은 짝 결과에 다시 넣고, 같은 사진 · 오래된 파일은 지운 기록에서 빠지는 것만으로 목록에 다시 나와요
    await markBack(back);
    return { restored: back.length, refused };
  } finally {
    g.__tiddiTrashBusy = false;
  }
}
