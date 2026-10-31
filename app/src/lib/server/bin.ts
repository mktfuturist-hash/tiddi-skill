// 윈도우 휴지통이 얼마나 받아 줄 수 있는지 알아봐요 (scripts/bin.ps1, 읽기만 해요).
// 휴지통보다 큰 파일은 휴지통을 거치지 않고 지워질 수 있어서, 이 한도를 넘게는 보내지 않아요.
import { execFile } from "node:child_process";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "bin.ps1");
// 정보를 못 읽으면 안전하게 2GB까지만
const FALLBACK = 2 * 1024 ** 3;

export type BinInfo = { limit: number; maxBytes: number | null; usedBytes: number; off: boolean };

const g = globalThis as unknown as { __tiddiBin?: { at: number; info: BinInfo } };

export async function binInfo(): Promise<BinInfo> {
  if (g.__tiddiBin && Date.now() - g.__tiddiBin.at < 30_000) return g.__tiddiBin.info;
  const out = await new Promise<string>((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", SCRIPT], { windowsHide: true, timeout: 20_000 }, (err, stdout) =>
      resolve(err ? "" : String(stdout).trim()),
    );
  });
  const [maxMB, nuke, used] = out.split("\t");
  const maxBytes = Number(maxMB) > 0 ? Number(maxMB) * 1024 * 1024 : null;
  const usedBytes = Number(used) || 0;
  const off = nuke === "1";
  // 휴지통 크기의 90%에서 이미 든 만큼을 뺀 만큼까지
  const limit = off ? 0 : maxBytes ? Math.max(0, Math.floor(maxBytes * 0.9) - usedBytes) : FALLBACK;
  const info = { limit, maxBytes, usedBytes, off };
  g.__tiddiBin = { at: Date.now(), info };
  return info;
}

export function forgetBin() {
  g.__tiddiBin = undefined;
}
