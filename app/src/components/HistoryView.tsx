import { formatBytes, showPath } from "@/lib/format";
import type { HistoryEntry } from "@/lib/trash-types";

function when(ms: number) {
  return new Date(ms).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function HistoryView({ history, busyId, onUndo }: { history: HistoryEntry[]; busyId: string | null; onUndo: (id: string) => void }) {
  if (history.length === 0) {
    return (
      <section className="rounded-3xl bg-card px-6 py-12 text-center ring-1 ring-line">
        <p className="text-5xl">🧺</p>
        <p className="mt-3 font-bold">아직 지운 게 없어요</p>
        <p className="mt-1 text-sm text-muted">휴지통으로 보낸 파일은 여기에 기록돼요. 여기서 언제든 되돌릴 수 있어요.</p>
      </section>
    );
  }
  return (
    <div className="space-y-3">
      <p className="px-1 text-sm text-muted">윈도우 휴지통을 비우기 전까지는 여기서 되돌릴 수 있어요.</p>
      {history.map((h) => (
        <section key={h.id} className="rounded-3xl bg-card p-5 ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              <b>{when(h.at)}</b> <span className="text-muted">· {h.items.length.toLocaleString("ko-KR")}장 · {formatBytes(h.bytes)}</span>
            </p>
            <button
              disabled={busyId !== null}
              onClick={() => onUndo(h.id)}
              className="rounded-full bg-line px-4 py-1.5 text-sm font-bold hover:brightness-95 disabled:opacity-50"
            >
              {busyId === h.id ? "되살리는 중…" : "↩︎ 되돌리기"}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {h.items.slice(0, 4).map((s) => (
              <li key={s.path} className="truncate">
                {showPath(s.folder)} › {s.name}
              </li>
            ))}
            {h.items.length > 4 && <li>외 {h.items.length - 4}장</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}
