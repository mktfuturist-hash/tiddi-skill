// TIDDI 설정 (data/settings.json). 팝업과 전체 화면이 같은 설정을 따라요
import { promises as fsp } from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");
const FILE = path.join(DATA, "settings.json");

export type Settings = {
  // 중복 정리에서 최근 7일 안의 파일을 보호할지 (기본: 보호)
  protectRecent: boolean;
};

const DEFAULTS: Settings = { protectRecent: true };

export async function getSettings(): Promise<Settings> {
  try {
    const saved = JSON.parse(await fsp.readFile(FILE, "utf8")) as Partial<Settings>;
    return { ...DEFAULTS, ...saved, protectRecent: saved.protectRecent !== false };
  } catch {
    return DEFAULTS;
  }
}

export async function updateSettings(patch: unknown): Promise<Settings> {
  const next = { ...(await getSettings()) };
  if (patch && typeof patch === "object" && "protectRecent" in patch && typeof patch.protectRecent === "boolean") {
    next.protectRecent = patch.protectRecent;
  }
  await fsp.mkdir(DATA, { recursive: true });
  await fsp.writeFile(FILE, JSON.stringify(next));
  return next;
}
