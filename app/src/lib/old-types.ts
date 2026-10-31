import type { OldGroup } from "./file-kinds";

// 오래된 파일 후보 하나 (드라이브 훑기 때 모아 둬요)
export type OldFile = {
  path: string;
  name: string;
  folder: string;
  size: number;
  // 마지막으로 고친 때
  time: string;
  group: OldGroup;
};

export type OldQuery = {
  months: number;
  minMB: number;
  group: OldGroup | "all";
};

export type OldResult = {
  scannedAt: number | null;
  // 조건에 맞는 전체 (목록은 큰 순서로 일부만 보내요)
  total: number;
  bytes: number;
  byGroup: Record<OldGroup, { count: number; bytes: number }>;
  items: OldFile[];
  // 지금 휴지통에 한 번에 보낼 수 있는 최대 크기 (이보다 큰 파일은 고를 수 없어요)
  binLimit: number;
};

// 오래된 파일로 휴지통에 보낼 수 있는 최소 기간
export const OLD_MIN_MONTHS = 6;
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
