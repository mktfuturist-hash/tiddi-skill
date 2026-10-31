import type { DirKind, MapDir, TypeKey } from "@/lib/scan-types";

export type Tone = "peach" | "mint" | "butter" | "lilac" | "sky" | "rose" | "sand";

export const TONE_BG: Record<Tone, string> = {
  peach: "bg-peach",
  mint: "bg-mint",
  butter: "bg-butter",
  lilac: "bg-lilac",
  sky: "bg-sky",
  rose: "bg-rose",
  sand: "bg-sand",
};

const ROTATE: Tone[] = ["peach", "mint", "butter", "lilac", "rose", "sky"];

export function toneForDir(dir: MapDir, index: number): Tone {
  if (dir.kind === "screenshots") return "peach";
  if (dir.kind === "onedrive") return "sky";
  if (dir.locked || dir.kind === "system" || dir.kind === "appdata" || dir.kind === "recycle") return "sand";
  return ROTATE[index % ROTATE.length];
}

export const TYPE_TONE: Record<TypeKey, Tone> = {
  app: "sand",
  etc: "butter",
  video: "lilac",
  dev: "mint",
  image: "rose",
  doc: "sky",
  archive: "peach",
};

const KIND_NOTE: Record<DirKind, string> = {
  screenshots: "윈도우 스크린샷 폴더예요. 짝 찾기에서 정리해요",
  onedrive: "OneDrive 폴더예요. 여기서 지우면 웹 · 폰에서도 사라져요 (30일 동안 되살릴 수 있어요)",
  appdata: "프로그램 설정 · 캐시예요. 보기만 해요 (캐시 청소는 다음 버전에서)",
  system: "윈도우 · 설치한 프로그램 영역이에요. 보기만 해요. 프로그램은 설정 → 앱에서 지워요",
  recycle: "윈도우 휴지통이에요. 휴지통을 비우면 이만큼 바로 생겨요",
};

export function noteForDir(dir: MapDir): string {
  if (dir.kind) return KIND_NOTE[dir.kind];
  return dir.locked ? "보기만 해요" : "";
}

const SHOT_TONES = ["#ffcdb8", "#c3ecd8", "#ffe9a8", "#ddcdfd", "#c4e2f8", "#f9c6d1"];

export function shotTone(seed: number): string {
  return SHOT_TONES[seed % SHOT_TONES.length];
}
