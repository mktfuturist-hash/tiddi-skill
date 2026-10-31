import type { PairShot } from "./pair-types";

// 휴지통으로 보낼 수 있는 것의 종류
// pair: 사본이 있는 스크린샷 원본 · unique: 사본 없는 스크린샷 · dup: 같은 사진 여러 벌 중 하나 · old: 오래된 파일
export type TrashKind = "pair" | "unique" | "dup" | "old";

export type TrashItem = {
  path: string;
  name: string;
  folder: string;
  size: number;
  time: string;
  kind: TrashKind;
  month?: string;
  copy?: PairShot["copy"];
  // 같은 사진 여러 벌이면 어느 묶음이었는지 (되살릴 때 다시 넣어요)
  group?: string;
};

// 휴지통으로 보낸 한 번의 기록
export type HistoryEntry = { id: string; at: number; items: TrashItem[]; bytes: number };

// 안전 확인에서 걸러졌거나 옮기지 못한 파일
export type Refused = { path: string; name: string; reason: string };

// 최근 7일 안의 파일은 보호해요 (PRD 안전 규칙)
export const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecent(item: { time: string }, now: number) {
  return now - Date.parse(item.time) < RECENT_MS;
}
