const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes >= GB) {
    const gb = bytes / GB;
    return `${gb.toFixed(gb >= 100 ? 0 : 1)}GB`;
  }
  if (bytes >= MB) {
    const mb = bytes / MB;
    return `${mb.toFixed(mb >= 100 ? 0 : 1)}MB`;
  }
  return `${Math.max(1, Math.round(bytes / KB))}KB`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

// 같은 씨앗이면 늘 같은 숫자가 나와요. 서버와 브라우저 화면이 어긋나지 않게 해요
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 한글 글꼴에서는 \ 가 안 보이거나 ₩로 보여서, 폴더 경로는 › 로 이어 보여 줘요
export function showPath(p: string): string {
  return p.split("\\").filter(Boolean).join(" › ");
}
