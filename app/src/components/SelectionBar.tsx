import { formatBytes } from "@/lib/format";
import { RECON } from "@/lib/mode";

// 화면 아래에 붙는 「선택 N개 · 용량 · 휴지통으로 보내기」 막대
export default function SelectionBar({ count, bytes, unit = "장", onClear, onTrash }: { count: number; bytes: number; unit?: string; onClear: () => void; onTrash: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span>
            <b className="text-base">
              선택 {count.toLocaleString("ko-KR")}
              {unit}
            </b>{" "}
            <span className="text-muted">· {formatBytes(bytes)}</span>
          </span>
          {count > 0 && (
            <button onClick={onClear} className="text-xs font-semibold text-muted underline hover:text-ink">
              모두 해제
            </button>
          )}
        </p>
        <button
          disabled={RECON || count === 0}
          onClick={onTrash}
          title={RECON ? "정찰 모드라 아직 지울 수 없어요" : undefined}
          className="rounded-full bg-key px-5 py-2.5 font-bold text-key-ink ring-1 ring-key-strong transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {RECON ? "👀 정찰 모드 · 아직 못 지워요" : "🗑️ 휴지통으로 보내기"}
        </button>
      </div>
    </div>
  );
}
