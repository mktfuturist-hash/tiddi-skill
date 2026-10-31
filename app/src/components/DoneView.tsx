import { formatBytes } from "@/lib/format";
import type { Refused } from "@/lib/trash-types";

type Props = {
  count: number;
  bytes: number;
  refused: Refused[];
  undoing: boolean;
  onUndo: () => void;
  onHome: () => void;
};

export default function DoneView({ count, bytes, refused, undoing, onUndo, onHome }: Props) {
  return (
    <section className="rounded-3xl bg-card px-6 py-12 text-center shadow-sm ring-1 ring-line">
      {count > 0 ? (
        <>
          <p className="text-6xl">✨</p>
          <p className="mt-4 text-5xl font-extrabold tracking-tight text-mint-deep sm:text-6xl">{formatBytes(bytes)} 확보!</p>
          <p className="mt-6 text-sm">
            윈도우 휴지통에 {count.toLocaleString("ko-KR")}장이 들어 있어요. 마음이 바뀌면 바로 되돌릴 수 있어요.
          </p>
          <p className="mt-1 text-xs text-muted">휴지통을 비우기 전까지는 디스크 용량이 그대로예요. 다 확인하신 뒤에 윈도우 휴지통을 비우면 용량이 생겨요.</p>
        </>
      ) : (
        <>
          <p className="text-5xl">🙅</p>
          <p className="mt-3 text-2xl font-extrabold">보낸 파일이 없어요</p>
        </>
      )}
      {refused.length > 0 && (
        <div className="mx-auto mt-6 max-w-lg rounded-2xl bg-cream p-4 text-left text-sm">
          <p className="font-bold">안전 확인에서 {refused.length}장을 건너뛰었어요</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-muted">
            {refused.map((r) => (
              <li key={r.path} className="truncate" title={r.path}>
                {r.name} — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {count > 0 && (
          <button disabled={undoing} onClick={onUndo} className="rounded-full bg-line px-5 py-2.5 font-bold hover:brightness-95 disabled:opacity-50">
            {undoing ? "되살리는 중…" : "↩︎ 되돌리기"}
          </button>
        )}
        <button onClick={onHome} className="rounded-full bg-ink px-5 py-2.5 font-bold text-white hover:brightness-110">
          홈으로
        </button>
      </div>
    </section>
  );
}
