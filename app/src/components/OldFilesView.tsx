"use client";

import { useEffect, useState } from "react";
import { isPicture, OLD_GROUP_LABEL, type OldGroup } from "@/lib/file-kinds";
import { formatBytes, showPath } from "@/lib/format";
import type { OldFile, OldResult } from "@/lib/old-types";
import SelectionBar from "./SelectionBar";
import Thumb from "./Thumb";

type Props = {
  // 휴지통으로 보낸 뒤 목록을 다시 불러오게 바뀌는 값
  reloadKey: number;
  onTrash: (items: OldFile[]) => void;
  onScan: () => void;
};

const MONTHS: Array<[number, string]> = [
  [6, "6개월"],
  [12, "1년"],
  [24, "2년"],
  [36, "3년"],
];
const SIZES: Array<[number, string]> = [
  [1, "1MB"],
  [10, "10MB"],
  [100, "100MB"],
];
const GROUP_ICON: Record<OldGroup, string> = { media: "🎬", doc: "📄", install: "📦", etc: "🗂️" };


function day(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

export default function OldFilesView({ reloadKey, onTrash, onScan }: Props) {
  const [months, setMonths] = useState(12);
  const [minMB, setMinMB] = useState(10);
  const [group, setGroup] = useState<OldGroup | "all">("all");
  const [drive, setDrive] = useState<string>("all");
  const [data, setData] = useState<OldResult | null>(null);
  const [selected, setSelected] = useState<Map<string, OldFile>>(() => new Map());

  useEffect(() => {
    const q = new URLSearchParams({ months: String(months), min: String(minMB), group, drive });
    let alive = true;
    fetch(`/api/old?${q}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<OldResult>)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [months, minMB, group, drive, reloadKey]);

  // 목록에서 사라진 파일(휴지통으로 간 것)은 선택에서 빼요
  const visible = new Set((data?.items ?? []).map((f) => f.path));
  const picked = [...selected.values()].filter((f) => visible.has(f.path));

  const toggle = (f: OldFile) => {
    const next = new Map(selected);
    if (next.has(f.path)) next.delete(f.path);
    else next.set(f.path, f);
    setSelected(next);
  };

  const setAll = (list: OldFile[], on: boolean) => {
    const next = new Map(selected);
    for (const f of list) {
      if (on) next.set(f.path, f);
      else next.delete(f.path);
    }
    setSelected(next);
  };

  if (data && data.scannedAt === null) {
    return (
      <section className="rounded-3xl bg-card px-6 py-10 text-center ring-1 ring-line">
        <p className="text-5xl">🗂️</p>
        <h2 className="mt-3 text-2xl font-extrabold">오래된 파일 목록이 아직 없어요</h2>
        <p className="mt-2 text-muted">홈에서 「다시 훑기」를 한 번 하면 만들어져요. 1~3분 걸려요.</p>
        <button onClick={onScan} className="mt-6 rounded-full bg-key px-8 py-3.5 text-lg font-bold text-key-ink hover:brightness-95">
          지금 훑기
        </button>
      </section>
    );
  }

  const items = data?.items ?? [];
  // 그 드라이브 휴지통에 남은 자리보다 큰 파일은 휴지통을 거치지 않고 지워질 수 있어서 고를 수 없게 해요
  const limitOf = (f: OldFile) => data?.binLimits?.[f.drive] ?? 0;
  const sendable = items.filter((f) => f.size <= limitOf(f));
  const allOn = sendable.length > 0 && sendable.every((f) => selected.has(f.path));

  return (
    <div className="pb-28">
      <section className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-line">
        <p className="text-sm">
          오랫동안 <b>고친 적이 없는</b> 파일이에요. 윈도우가 깔린 드라이브(보통 C)에서는 내 사용자 폴더(바탕 화면 · 문서 · 사진 · 다운로드 · OneDrive)만, 다른 드라이브(D 등)는 드라이브
          전체를 봐요. <b>AppData · 숨김 폴더 · 개발 프로젝트 · 프로그램 · 게임 폴더는 빼요.</b>
        </p>
        <p className="rounded-2xl bg-sky/50 px-3 py-2 text-xs">
          ☁️ OneDrive 파일은 지우지 않고도 용량을 비울 수 있어요. 탐색기에서 폴더를 우클릭 → <b>「공간 확보」</b>를 누르면 파일은 클라우드에 남고 내 컴퓨터에서만 비워져요.
        </p>
        {data && data.byDrive.length > 1 && (
          <Chips
            label="드라이브"
            value={drive}
            options={[["all", "전체"], ...data.byDrive.map((d): [string, string] => [d.letter, `${d.letter} 드라이브 ${d.count.toLocaleString("ko-KR")}`])]}
            onChange={setDrive}
          />
        )}
        <Chips label="기간" value={months} options={MONTHS.map(([v, l]) => [v, `${l} 넘게`])} onChange={setMonths} />
        <Chips label="크기" value={minMB} options={SIZES.map(([v, l]) => [v, `${l} 이상`])} onChange={setMinMB} />
        <Chips
          label="종류"
          value={group}
          options={[
            ["all", "전체"],
            ...(Object.keys(OLD_GROUP_LABEL) as OldGroup[]).map((k): [OldGroup, string] => [k, `${OLD_GROUP_LABEL[k]} ${data ? data.byGroup[k].count.toLocaleString("ko-KR") : ""}`]),
          ]}
          onChange={setGroup}
        />
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
        <p>
          {data ? (
            <>
              <b>{data.total.toLocaleString("ko-KR")}개 · {formatBytes(data.bytes)}</b>
              <span className="text-muted">
                {" "}
                · 큰 순서{data.total > items.length ? `로 ${items.length}개까지 보여요` : "예요"}
              </span>
            </>
          ) : (
            <span className="text-muted">불러오는 중…</span>
          )}
        </p>
        {items.length > 0 && (
          <button onClick={() => setAll(sendable, !allOn)} className="rounded-full bg-card px-3 py-1 font-semibold ring-1 ring-line hover:bg-line">
            {allOn ? "보이는 것 모두 해제" : "보이는 것 모두 선택"}
          </button>
        )}
      </div>

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-card ring-1 ring-line">
        {items.map((f) => {
          const on = selected.has(f.path);
          const big = f.size > limitOf(f);
          return (
            <li key={f.path}>
              <label className={`flex items-center gap-3 px-4 py-2.5 ${big ? "" : "cursor-pointer"} ${on ? "bg-key/30" : "hover:bg-cream"}`}>
                {big ? (
                  <span className="w-4 shrink-0 text-center" title="휴지통에 남은 자리보다 커서 보내지 않아요">
                    🚫
                  </span>
                ) : (
                  <input type="checkbox" checked={on} onChange={() => toggle(f)} className="size-4 shrink-0 accent-mint-deep" />
                )}
                {isPicture(f.name) ? (
                  <Thumb path={f.path} className="size-11 shrink-0" />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-line text-lg">{GROUP_ICON[f.group]}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" title={f.name}>
                    {f.name}
                  </span>
                  <span className="block truncate text-xs text-muted" title={showPath(f.folder)}>
                    {showPath(f.folder)}
                  </span>
                  {big && <span className="mt-0.5 inline-block rounded-full bg-sky px-2 py-0.5 text-[11px] font-bold">휴지통보다 커요 · 휴지통을 비우거나 「공간 확보」</span>}
                </span>
                <span className="shrink-0 text-right text-xs">
                  <b className="block text-sm">{formatBytes(f.size)}</b>
                  <span className="text-muted">{day(f.time)}</span>
                </span>
              </label>
            </li>
          );
        })}
        {data && items.length === 0 && <li className="px-4 py-10 text-center text-muted">조건에 맞는 파일이 없어요.</li>}
      </ul>

      <SelectionBar
        count={picked.length}
        bytes={picked.reduce((a, f) => a + f.size, 0)}
        unit="개"
        onClear={() => setAll(picked, false)}
        onTrash={() => onTrash(picked)}
      />
    </div>
  );
}

function Chips<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="w-14 shrink-0 font-semibold text-muted">{label}</span>
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 font-semibold transition ${value === v ? "bg-ink text-white" : "bg-cream ring-1 ring-line hover:bg-line"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
