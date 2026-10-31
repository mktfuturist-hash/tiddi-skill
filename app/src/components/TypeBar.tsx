import { formatBytes } from "@/lib/format";
import { TYPE_LABEL, type TypeKey } from "@/lib/scan-types";
import { TONE_BG, TYPE_TONE } from "./tones";

export default function TypeBar({ types }: { types: Record<TypeKey, number> }) {
  const list = (Object.keys(types) as TypeKey[]).map((k) => ({ key: k, size: types[k] })).filter((t) => t.size > 0).sort((a, b) => b.size - a.size);
  const total = list.reduce((a, t) => a + t.size, 0);
  return (
    <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-line">
      <h2 className="text-lg font-bold">유형별</h2>
      <div className="mt-3 flex h-6 overflow-hidden rounded-full">
        {list.map((t) => (
          <div
            key={t.key}
            className={`${TONE_BG[TYPE_TONE[t.key]]} border-r-2 border-card last:border-r-0`}
            style={{ width: `${(t.size / total) * 100}%` }}
            title={`${TYPE_LABEL[t.key]} ${formatBytes(t.size)}`}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {list.map((t) => (
          <li key={t.key} className="flex items-center gap-2">
            <span className={`size-3 shrink-0 rounded-full ${TONE_BG[TYPE_TONE[t.key]]}`} />
            <span className="font-semibold">{TYPE_LABEL[t.key]}</span>
            <span className="text-muted">{formatBytes(t.size)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">개발 파일 = node_modules · .git · .next 안의 파일이에요. 「기타」에는 캐시 · 설정 · 확장자 없는 파일이 많아요.</p>
    </section>
  );
}
