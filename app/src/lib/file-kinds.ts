// 파일 이름으로 종류를 가려요 (오래된 파일 화면의 묶음)
export type OldGroup = "media" | "doc" | "install" | "etc";

export const OLD_GROUP_LABEL: Record<OldGroup, string> = {
  media: "사진 · 영상",
  doc: "문서",
  install: "압축 · 설치 파일",
  etc: "기타",
};

const EXT: Record<string, OldGroup> = {};
const lists: Array<[OldGroup, string]> = [
  ["media", "png jpg jpeg gif webp heic bmp tif tiff psd ai raw cr2 nef mp4 mov avi mkv wmv m4v webm mts mp3 m4a wav"],
  ["doc", "pdf doc docx xls xlsx ppt pptx hwp hwpx txt md csv key pages numbers"],
  ["install", "exe msi zip rar 7z tar gz iso dmg apk"],
];
for (const [group, list] of lists) for (const ext of list.split(" ")) EXT[ext] = group;

export function groupOf(name: string): OldGroup {
  const dot = name.lastIndexOf(".");
  return (dot >= 0 && EXT[name.slice(dot + 1).toLowerCase()]) || "etc";
}

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "bmp"]);

// 화면에서 작은 그림으로 보여 줄 수 있는 사진인지
export function isPicture(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 && IMAGE.has(name.slice(dot + 1).toLowerCase());
}
