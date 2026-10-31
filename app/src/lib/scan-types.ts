// 서버(훑기)와 화면이 같이 쓰는 모양이에요. 여기엔 Node 전용 코드를 넣지 않아요.

export type TypeKey = "image" | "video" | "doc" | "app" | "dev" | "archive" | "etc";

export type DirKind = "screenshots" | "onedrive" | "appdata" | "system" | "recycle";

export type MapDir = {
  name: string;
  path: string;
  size: number;
  files: number;
  // 휴지통 버튼을 절대 달지 않는 곳 (윈도우 · 프로그램 · AppData 등)
  locked: boolean;
  kind?: DirKind;
  children?: MapDir[];
  // 작아서 묶은 하위 폴더들
  rest?: { count: number; size: number };
  // 하위 폴더가 아니라 이 폴더에 바로 들어 있는 파일들
  own: number;
};

export type ScanResult = {
  scannedAt: number;
  durationMs: number;
  files: number;
  bytes: number;
  cloudBytes: number;
  skipped: number;
  home: string;
  screenshots: string | null;
  tree: MapDir;
  types: Record<TypeKey, number>;
};

export type ScanStatus = {
  status: "idle" | "running" | "error";
  progress: { files: number; bytes: number; current: string };
  startedAt: number | null;
  error: string | null;
  drive: { total: number; free: number };
  result: ScanResult | null;
};

export const TYPE_LABEL: Record<TypeKey, string> = {
  app: "앱 · 시스템",
  etc: "기타",
  video: "영상",
  dev: "개발 파일",
  image: "이미지",
  doc: "문서",
  archive: "압축 파일",
};
