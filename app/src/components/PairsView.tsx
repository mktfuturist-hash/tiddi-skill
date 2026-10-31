"use client";

import { useState } from "react";
import { formatBytes, formatMonth, showPath } from "@/lib/format";
import type { DupGroup, PairShot } from "@/lib/pair-types";
import DupesView from "./DupesView";
import SelectionBar from "./SelectionBar";
import Thumb from "./Thumb";

export type DupTab = "pair" | "dup" | "unique";

type Props = {
  pairs: PairShot[];
  uniques: PairShot[];
  dupes: DupGroup[];
  keeps: Record<string, string>;
  onKeep: (groupId: string, path: string) => void;
  tab: DupTab;
  onTab: (tab: DupTab) => void;
  selected: Set<string>;
  onToggle: (path: string) => void;
  onSetMany: (paths: string[], on: boolean) => void;
  onTrash: () => void;
  // 세 탭을 합친 선택 (아래 막대에 보여 줘요)
  picked: { paths: string[]; bytes: number };
};

// 한 달에 사진이 많으면 처음엔 이만큼만 보여 줘요
const FIRST_SHOW = 30;

function sum(list: PairShot[]) {
  return list.reduce((a, s) => a + s.size, 0);
}

export default function PairsView({ pairs, uniques, dupes, keeps, onKeep, tab, onTab, selected, onToggle, onSetMany, onTrash, picked }: Props) {
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [zoom, setZoom] = useState<PairShot | null>(null);
  const list = tab === "pair" ? pairs : tab === "unique" ? uniques : [];
  const months = [...new Set(list.map((s) => s.month))];
  const dupFree = dupes.reduce((a, d) => a + d.size * (d.files.length - 1), 0);

  return (
    <div className="pb-28">
      <div className="flex gap-2">
        <TabButton active={tab === "pair"} onClick={() => onTab("pair")} title="스크린샷 짝" sub={`${pairs.length.toLocaleString("ko-KR")}장 · ${formatBytes(sum(pairs))}`} />
        <TabButton active={tab === "dup"} onClick={() => onTab("dup")} title="같은 사진 여러 벌" sub={`${dupes.length.toLocaleString("ko-KR")}묶음 · 최대 ${formatBytes(dupFree)}`} />
        <TabButton active={tab === "unique"} onClick={() => onTab("unique")} title="스크린샷 유일본" sub={`${uniques.length.toLocaleString("ko-KR")}장 · ${formatBytes(sum(uniques))}`} />
      </div>

      <p className="mt-4 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-line">
        {tab === "dup" ? (
          <>
            내용이 <b>100% 똑같은</b> 사진 · 영상이 여러 폴더에 있는 묶음이에요. <b>묶음마다 하나는 꼭 남겨요.</b> 「이걸 남길게요」로 남길 파일을 바꿀 수 있어요. 개발
            프로젝트 안 파일과 최근 7일 파일은 지우지 않아요.
          </>
        ) : tab === "pair" ? (
          <>
            내가 따로 저장한 사본이 있는 스크린샷이에요. <b>지우는 건 왼쪽 스크린샷 원본뿐</b>이고, 오른쪽 사본은 그대로 둬요. 사진을 누르면 크게 비교할 수 있어요.
          </>
        ) : (
          <>
            다른 곳에 사본이 없는 스크린샷이에요. 개인 사진이 섞여 있을 수 있어서 <b>기본으로 아무것도 체크하지 않았어요.</b> 보고 직접 골라 주세요.
          </>
        )}
      </p>

      {tab === "dup" && <DupesView dupes={dupes} keeps={keeps} onKeep={onKeep} selected={selected} onToggle={onToggle} onSetMany={onSetMany} />}

      {tab !== "dup" && list.length === 0 && <p className="mt-10 text-center text-muted">{tab === "pair" ? "짝이 있는 스크린샷을 찾지 못했어요." : "유일본이 없어요."}</p>}

      {months.map((month) => {
        const group = list.filter((s) => s.month === month);
        const eligible = group.filter((s) => !s.recent);
        const allOn = eligible.length > 0 && eligible.every((s) => selected.has(s.path));
        const showAll = opened.has(month) || group.length <= FIRST_SHOW;
        const shown = showAll ? group : group.slice(0, FIRST_SHOW);
        return (
          <section key={month} className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                {formatMonth(month)} <span className="font-normal text-muted">· {group.length}장 · {formatBytes(sum(group))}</span>
              </h3>
              {eligible.length > 0 ? (
                <button
                  onClick={() => onSetMany(eligible.map((s) => s.path), !allOn)}
                  className="rounded-full bg-card px-3 py-1 text-sm font-semibold ring-1 ring-line hover:bg-line"
                >
                  {allOn ? "이 달 모두 해제" : `이 달 ${eligible.length}장 모두 선택`}
                </button>
              ) : (
                <span className="rounded-full bg-butter px-3 py-1 text-xs font-bold">🛡️ 최근 7일 · 보호 중</span>
              )}
            </div>
            {tab === "pair" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {shown.map((s) => (
                  <PairCard key={s.path} shot={s} locked={!!s.recent} on={selected.has(s.path)} onToggle={() => onToggle(s.path)} onZoom={() => setZoom(s)} />
                ))}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {shown.map((s) => (
                  <UniqueCard key={s.path} shot={s} locked={!!s.recent} on={selected.has(s.path)} onToggle={() => onToggle(s.path)} onZoom={() => setZoom(s)} />
                ))}
              </div>
            )}
            {!showAll && (
              <button
                onClick={() => setOpened(new Set([...opened, month]))}
                className="mt-3 w-full rounded-2xl bg-card py-2.5 text-sm font-semibold ring-1 ring-line hover:bg-line"
              >
                {group.length - FIRST_SHOW}장 더 보기
              </button>
            )}
          </section>
        );
      })}

      <SelectionBar count={picked.paths.length} bytes={picked.bytes} onClear={() => onSetMany(picked.paths, false)} onTrash={onTrash} />

      {zoom && <ZoomView shot={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function TabButton({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-2xl px-4 py-3 text-left transition ${active ? "bg-ink text-white" : "bg-card ring-1 ring-line hover:bg-line"}`}
    >
      <span className="block font-bold">{title}</span>
      <span className={`block text-sm ${active ? "text-white/70" : "text-muted"}`}>{sub}</span>
    </button>
  );
}

function PairCard({ shot, locked, on, onToggle, onZoom }: { shot: PairShot; locked: boolean; on: boolean; onToggle: () => void; onZoom: () => void }) {
  const copy = shot.copy!;
  return (
    <div className={`rounded-2xl bg-card p-3 ring-1 transition ${on ? "ring-2 ring-key-strong" : "ring-line"}`}>
      <div className="flex items-center justify-between">
        {locked ? (
          <span className="rounded-full bg-butter px-2 py-0.5 text-xs font-bold">🛡️ 최근 7일 · 보호 중</span>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={on} onChange={onToggle} className="size-4 accent-mint-deep" />
            원본 지우기
          </label>
        )}
        <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-mint-deep">닮음 {copy.similarity}%</span>
      </div>
      <button onClick={onZoom} className="mt-3 grid w-full grid-cols-2 gap-3 text-left">
        <figure className="min-w-0">
          <Thumb path={shot.path} className={`aspect-[4/3] w-full ${on ? "opacity-60" : ""}`} />
          <figcaption className="mt-2 text-xs">
            <span className="rounded bg-peach px-1.5 py-0.5 font-bold">지울 것</span>
            <span className="mt-1 block truncate font-semibold" title={shot.name}>{shot.name}</span>
            <span className="block truncate text-muted" title={showPath(shot.folder)}>{showPath(shot.folder)} · {formatBytes(shot.size)}</span>
          </figcaption>
        </figure>
        <figure className="min-w-0">
          <Thumb path={copy.path} className="aspect-[4/3] w-full" />
          <figcaption className="mt-2 text-xs">
            <span className="rounded bg-mint px-1.5 py-0.5 font-bold">남길 것</span>
            <span className="mt-1 block truncate font-semibold" title={copy.name}>{copy.name}</span>
            <span className="block truncate text-muted" title={showPath(copy.folder)}>{showPath(copy.folder)} · {formatBytes(copy.size)}</span>
          </figcaption>
        </figure>
      </button>
    </div>
  );
}

function UniqueCard({ shot, locked, on, onToggle, onZoom }: { shot: PairShot; locked: boolean; on: boolean; onToggle: () => void; onZoom: () => void }) {
  return (
    <div className={`relative rounded-xl bg-card p-1.5 ring-1 transition ${on ? "ring-2 ring-key-strong" : "ring-line"}`}>
      <button onClick={onZoom} className="block w-full">
        <Thumb path={shot.path} className={`aspect-square w-full ${on ? "opacity-60" : ""}`} />
      </button>
      {locked ? (
        <span className="absolute left-3 top-3 rounded-full bg-butter px-1.5 text-[10px] font-bold" title="최근 7일 · 보호 중">
          🛡️
        </span>
      ) : (
        <input type="checkbox" checked={on} onChange={onToggle} aria-label={`${shot.name} 선택`} className="absolute left-3 top-3 size-4 accent-mint-deep" />
      )}
      <span className="mt-1 block truncate px-0.5 text-[11px] text-muted" title={shot.name}>
        {formatBytes(shot.size)}
      </span>
    </div>
  );
}

function ZoomView({ shot, onClose }: { shot: PairShot; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/70 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-full w-full max-w-6xl overflow-auto rounded-3xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-bold">{shot.copy ? `닮음 ${shot.copy.similarity}% · 같은 장면인지 확인해 보세요` : "유일본"}</p>
          <button onClick={onClose} className="rounded-full bg-line px-4 py-1.5 text-sm font-bold hover:brightness-95">
            닫기
          </button>
        </div>
        <div className={`mt-3 grid gap-4 ${shot.copy ? "md:grid-cols-2" : ""}`}>
          <figure>
            <Thumb path={shot.path} className="max-h-[70vh] w-full object-contain" />
            <figcaption className="mt-2 text-xs">
              <span className="rounded bg-peach px-1.5 py-0.5 font-bold">스크린샷 원본</span> <span className="break-all text-muted">{showPath(shot.folder)} › {shot.name}</span>
            </figcaption>
          </figure>
          {shot.copy && (
            <figure>
              <Thumb path={shot.copy.path} className="max-h-[70vh] w-full object-contain" />
              <figcaption className="mt-2 text-xs">
                <span className="rounded bg-mint px-1.5 py-0.5 font-bold">내가 저장한 사본</span>{" "}
                <span className="break-all text-muted">
                  {showPath(shot.copy.folder)} › {shot.copy.name}
                </span>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </div>
  );
}
