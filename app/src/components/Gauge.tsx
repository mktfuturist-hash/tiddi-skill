import { formatBytes } from "@/lib/format";

const LOW = 10 * 1024 ** 3;

export default function Gauge({ label, total, free, freedNow = 0 }: { label: string; total: number; free: number; freedNow?: number }) {
  const used = total - free;
  const pct = (used / total) * 100;
  const low = free < LOW;
  return (
    <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-line">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
        <span className={low ? "text-coral" : "text-mint-deep"}>{formatBytes(free)}</span>
        <span className="ml-2 text-2xl font-bold text-ink sm:text-3xl">남음</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        전체 {formatBytes(total)} 중 {formatBytes(used)} 사용 중
        {freedNow > 0 && <span className="ml-2 font-semibold text-mint-deep">오늘 {formatBytes(freedNow)} 확보</span>}
      </p>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-line" role="img" aria-label={`사용 ${pct.toFixed(0)}%`}>
        <div className="h-full rounded-full bg-gradient-to-r from-key to-key-strong transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      {low && <p className="mt-3 text-sm">⚠️ 10GB 아래예요. 아래 지도에서 큰 칸부터 눌러 보세요.</p>}
    </section>
  );
}
