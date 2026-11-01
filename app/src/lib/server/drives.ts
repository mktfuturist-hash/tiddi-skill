// 이 컴퓨터의 드라이브와 드라이브마다의 휴지통 정보 (scripts/drives.ps1, 읽기만 해요).
// 휴지통이 없거나 믿을 수 없는 드라이브(USB · 외장 · 네트워크 · 가상 · FAT)는 보기만 해요.
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { PROTECTED_NAMES, letterOf, type Drive } from "@/lib/drive-types";

const SCRIPT = path.join(process.cwd(), "scripts", "drives.ps1");
// 휴지통 크기를 못 읽으면 안전하게 이만큼만
const FALLBACK = 2 * 1024 ** 3;

const g = globalThis as unknown as { __tiddiDrives?: { at: number; list: Drive[] } };

const KIND: Record<string, Drive["kind"]> = { Fixed: "fixed", Removable: "removable", Network: "network" };

export function systemLetter(): string {
  return (process.env.SystemDrive ?? "C:").slice(0, 1).toUpperCase();
}

function decide(kind: Drive["kind"], fs: string, usb: boolean, guid: string, nuke: string): string | null {
  if (kind === "network") return "네트워크 드라이브라 보기만 해요";
  if (kind !== "fixed" || usb) return "USB · 외장 드라이브는 휴지통이 없을 수 있어서 보기만 해요";
  if (!guid) return "가상 드라이브라 휴지통이 없어서 보기만 해요";
  if (!/^(ntfs|refs)$/i.test(fs)) return `${fs} 드라이브는 휴지통을 믿을 수 없어서 보기만 해요`;
  if (nuke === "1") return "이 드라이브는 휴지통이 꺼져 있어서(바로 영구 삭제) 보기만 해요";
  return null;
}

export async function listDrives(fresh = false): Promise<Drive[]> {
  if (!fresh && g.__tiddiDrives && Date.now() - g.__tiddiDrives.at < 30_000) return g.__tiddiDrives.list;
  const out = await new Promise<string>((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", SCRIPT], { windowsHide: true, timeout: 30_000 }, (err, stdout) =>
      resolve(err ? "" : String(stdout)),
    );
  });
  const sys = systemLetter();
  const list: Drive[] = [];
  for (const line of out.split(/\r?\n/)) {
    const f = line.split("\t");
    if (f[0] !== "V") continue;
    const [, letter, type, fs, total, free, label, usb, guid, maxMB, nuke, used] = f;
    const kind = KIND[type] ?? "other";
    const reason = decide(kind, fs, usb === "1", guid, nuke);
    const max = Number(maxMB) > 0 ? Number(maxMB) * 1024 * 1024 : null;
    const binLimit = reason ? 0 : max ? Math.max(0, Math.floor(max * 0.9) - (Number(used) || 0)) : Math.min(FALLBACK, Math.floor(Number(total) * 0.05));
    list.push({ letter, root: `${letter}:\\`, label: label ?? "", kind, fs, total: Number(total), free: Number(free), system: letter === sys, manage: !reason, reason, binLimit });
  }
  // 드라이브 정보를 못 읽었으면 적어도 시스템 드라이브는 보기만으로라도 보여 줘요
  if (list.length === 0) {
    list.push({ letter: sys, root: `${sys}:\\`, label: "", kind: "fixed", fs: "", total: 0, free: 0, system: true, manage: false, reason: "드라이브 정보를 읽지 못했어요", binLimit: 0 });
  }
  list.sort((a, b) => (a.system === b.system ? a.letter.localeCompare(b.letter) : a.system ? -1 : 1));
  g.__tiddiDrives = { at: Date.now(), list };
  return list;
}

export function forgetDrives() {
  g.__tiddiDrives = undefined;
}

// 이 경로를 휴지통으로 보내도 되는 곳인지 (안 되면 이유)
export function placeProblem(p: string, drives: Drive[]): string | null {
  const drive = drives.find((d) => d.letter === letterOf(p));
  if (!drive) return "TIDDI가 모르는 드라이브예요";
  if (!drive.manage) return `${drive.letter} 드라이브는 ${drive.reason}`;
  const lower = p.toLowerCase();
  if (drive.system) {
    const home = `${os.homedir().toLowerCase()}\\`;
    if (!lower.startsWith(home) || lower.startsWith(`${home}appdata\\`)) return `${drive.letter} 드라이브에서는 내 사용자 폴더(AppData 빼고) 안의 파일만 보내요`;
    return null;
  }
  const parts = lower.slice(3).split("\\").slice(0, -1);
  if (parts.some((s) => s.startsWith(".") || PROTECTED_NAMES.includes(s))) return "프로그램 · 게임 · 시스템 폴더 안의 파일은 보내지 않아요";
  return null;
}
