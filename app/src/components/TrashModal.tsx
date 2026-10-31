import { formatBytes } from "@/lib/format";

// 휴지통으로 보낼 계획 (중복 정리 화면 · 오래된 파일 화면에서 만들어요)
export type TrashPlan = { kind: "dupes" | "old"; paths: string[]; bytes: number; uniqueCount: number };

type Props = { plan: TrashPlan; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void };

export default function TrashModal({ plan, busy, error, onCancel, onConfirm }: Props) {
  const count = plan.paths.length;
  const inOneDrive = plan.paths.some((p) => /\\onedrive\\/i.test(p));
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-xl">
        <p className="text-4xl">🗑️</p>
        <h2 className="mt-2 text-xl font-extrabold">
          {count.toLocaleString("ko-KR")}개 · {formatBytes(plan.bytes)}를 휴지통으로 보내요
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>✅ 영구 삭제가 아니에요. 윈도우 휴지통에서 언제든 되살릴 수 있어요.</li>
          {plan.kind === "dupes" ? (
            <>
              <li>✅ 스크린샷 짝은 <b>원본만</b>, 같은 사진 여러 벌은 <b>묶음마다 하나는 꼭 남겨요.</b></li>
              <li>✅ 보내기 직전에 파일마다 다시 확인해요 (그대로인지 · 남길 파일이 있는지 · 최근 7일 파일이 아닌지).</li>
            </>
          ) : (
            <li>✅ 보내기 직전에 파일마다 다시 확인해요 (훑은 뒤 바뀌지 않았는지 · 6개월 넘었는지).</li>
          )}
          {plan.uniqueCount > 0 && (
            <li className="rounded-xl bg-peach/50 px-3 py-2">
              ⚠️ 이 중 <b>{plan.uniqueCount.toLocaleString("ko-KR")}장은 사본이 없는 스크린샷</b>이에요.
            </li>
          )}
        </ul>
        {inOneDrive && (
          <div className="mt-4 rounded-2xl bg-sky/60 px-4 py-3 text-sm">
            <b>☁️ OneDrive 폴더 파일이 있어요.</b> 휴지통으로 보내면 OneDrive 웹과 폰에서도 같이 사라져요. OneDrive 휴지통에서 30일 동안 되살릴 수 있어요.
          </div>
        )}
        <p className="mt-3 text-xs text-muted">휴지통에 남은 자리보다 많이는 보내지 않아요. 용량은 윈도우 휴지통을 비운 뒤에 생겨요.</p>
        {error && <p className="mt-3 rounded-xl bg-peach/60 px-3 py-2 text-sm">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button disabled={busy} onClick={onCancel} className="flex-1 rounded-full bg-line px-4 py-3 font-bold hover:brightness-95 disabled:opacity-50">
            취소
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-full bg-key px-4 py-3 font-bold text-key-ink ring-1 ring-key-strong hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "보내는 중…" : "휴지통으로 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
