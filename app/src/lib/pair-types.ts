// 짝 찾기 결과 모양 (서버와 화면이 같이 써요)

export type PairShot = {
  path: string;
  name: string;
  // 내 사용자 폴더 기준으로 줄인 경로 (보여 주기용)
  folder: string;
  size: number;
  time: string;
  month: string;
  // 최근 7일 안의 파일이라 보호 중인지 (서버가 알려 줘요)
  recent?: boolean;
  copy?: { path: string; name: string; folder: string; size: number; similarity: number };
};

// 같은 사진 여러 벌 (내용이 100% 같은 파일)
export type DupFile = {
  path: string;
  name: string;
  folder: string;
  size: number;
  time: string;
  // 개발 프로젝트(package.json · .git) 안이라 절대 지우지 않는 파일
  project: boolean;
  recent?: boolean;
};

export type DupGroup = {
  id: string;
  size: number;
  files: DupFile[];
  // 기본으로 남길 파일 (프로젝트 안 → 다운로드 · 카톡 받은 파일 밖 → 가장 오래된 것)
  keep: string;
  // 모두 같은 폴더 안이면 영상 프레임처럼 일부러 둔 것일 수 있어서 기본 선택하지 않아요
  sameFolder: boolean;
};

export type PairsResult = {
  foundAt: number;
  durationMs: number;
  screenshots: string;
  shotCount: number;
  // 비교 대상으로 훑은 내 폴더의 사진 수
  scanned: number;
  pairs: PairShot[];
  uniques: PairShot[];
  dupes?: DupGroup[];
};

export type PairsStatus = {
  status: "idle" | "running" | "error";
  progress: { stage: string; count: string; current: string };
  startedAt: number | null;
  error: string | null;
  result: PairsResult | null;
};

// 같은 사진 여러 벌에서 기본으로 휴지통에 넣을 파일: 남길 것 · 프로젝트 · 최근 7일이 아니고, 남길 것과 다른 폴더에 있는 것
export function defaultDupPicks(group: DupGroup): DupFile[] {
  if (group.sameFolder) return [];
  const keepDir = group.files.find((f) => f.path === group.keep)?.folder;
  return group.files.filter((f) => f.path !== group.keep && !f.project && !f.recent && f.folder !== keepDir);
}
