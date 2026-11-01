// 이 컴퓨터의 드라이브 (서버와 화면이 같이 써요)
export type Drive = {
  letter: string;
  root: string;
  label: string;
  kind: "fixed" | "removable" | "network" | "other";
  fs: string;
  total: number;
  free: number;
  // 윈도우가 깔린 드라이브 (보통 C)
  system: boolean;
  // 휴지통으로 보내기까지 할 수 있는지. 아니면 보기만 해요
  manage: boolean;
  // 보기만 하는 이유
  reason: string | null;
  // 이 드라이브 휴지통에 한 번에 보낼 수 있는 최대 크기
  binLimit: number;
};

// 드라이브 안에서 보기만 하는 폴더 이름 (어느 깊이에 있든)
export const PROTECTED_NAMES = [
  "$recycle.bin",
  "system volume information",
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
  "windowsapps",
  "recovery",
  "config.msi",
  "msocache",
  "steamlibrary",
  "steamapps",
  "xboxgames",
  "epic games",
  "riot games",
  "node_modules",
];

export function letterOf(p: string): string {
  return p.slice(0, 1).toUpperCase();
}

export function driveName(d: Pick<Drive, "letter" | "label">): string {
  return d.label ? `${d.letter} 드라이브 (${d.label})` : `${d.letter} 드라이브`;
}
