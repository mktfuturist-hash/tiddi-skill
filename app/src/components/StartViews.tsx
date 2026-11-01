import { formatBytes } from "@/lib/format";

export function FirstRun({ onScan }: { onScan: () => void }) {
  return (
    <section className="rounded-3xl bg-card px-6 py-10 text-center ring-1 ring-line">
      {/* eslint-disable-next-line @next/next/no-img-element -- 작은 로고 한 장이라 next/image 최적화가 필요 없어요 */}
      <img src="/tiddi.png" alt="" className="mx-auto size-20 rounded-[22%] shadow-sm" />
      <h2 className="mt-3 text-2xl font-extrabold">아직 훑어보지 않았어요</h2>
      <p className="mt-2 text-muted">
        C 드라이브를 훑어서 뭐가 용량을 먹는지 찾아요. 3분쯤 걸려요.
        <br />
        <b className="text-ink">읽기만 해요. 아무것도 지우지 않아요.</b>
      </p>
      <button onClick={onScan} className="mt-6 rounded-full bg-key px-8 py-3.5 text-lg font-bold text-key-ink shadow-sm hover:brightness-95">
        내 컴퓨터 훑기
      </button>
    </section>
  );
}

export function Scanning({ files, bytes, used, current }: { files: number; bytes: number; used: number; current: string }) {
  // 훑은 양 ÷ 사용 중인 용량으로 대략 몇 %인지 어림해요
  const pct = used > 0 ? Math.min(99, (bytes / used) * 100) : 0;
  return (
    <section className="rounded-3xl bg-card px-6 py-10 ring-1 ring-line">
      <p className="text-center text-5xl">🔎</p>
      <h2 className="mt-3 text-center text-2xl font-extrabold">훑는 중이에요</h2>
      <p className="mt-1 text-center text-sm text-muted">읽기만 하고 있어요. 3분쯤 걸려요. 다른 일 하셔도 돼요.</p>
      <div className="mx-auto mt-6 max-w-lg">
        <div className="h-4 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gradient-to-r from-key to-key-strong transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between gap-3 text-sm">
          <span className="truncate text-muted" title={current}>
            {current || "시작하는 중…"}
          </span>
          <span className="shrink-0 font-semibold">
            {files.toLocaleString("ko-KR")}개 · {formatBytes(bytes)} · 약 {Math.floor(pct)}%
          </span>
        </div>
      </div>
    </section>
  );
}
