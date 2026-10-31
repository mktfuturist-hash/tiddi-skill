"use client";

import { useState } from "react";
import { isPicture } from "@/lib/file-kinds";
import { formatBytes, showPath } from "@/lib/format";
import type { DupFile, DupGroup } from "@/lib/pair-types";
import Thumb from "./Thumb";

type Props = {
  dupes: DupGroup[];
  keeps: Record<string, string>;
  onKeep: (groupId: string, path: string) => void;
  selected: Set<string>;
  onToggle: (path: string) => void;
  onSetMany: (paths: string[], on: boolean) => void;
};

const FIRST_SHOW = 40;

function day(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

export default function DupesView({ dupes, keeps, onKeep, selected, onToggle, onSetMany }: Props) {
  const [limit, setLimit] = useState(FIRST_SHOW);
  const [zoom, setZoom] = useState<DupFile | null>(null);

  if (dupes.length === 0) return <p className="mt-10 text-center text-muted">내용이 똑같은 사진 · 영상 묶음을 찾지 못했어요.</p>;

  return (
    <div className="mt-2 space-y-4">
      {dupes.slice(0, limit).map((grp) => {
        const keep = keeps[grp.id] ?? grp.keep;
        const eligible = grp.files.filter((f) => f.path !== keep && !f.project && !f.recent);
        const allOn = eligible.length > 0 && eligible.every((f) => selected.has(f.path));
        return (
          <section key={grp.id} className="rounded-3xl bg-card p-4 ring-1 ring-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <b className="text-base">같은 파일 {grp.files.length}벌</b>{" "}
                <span className="text-muted">
                  · 하나당 {formatBytes(grp.size)} · 비울 수 있는 최대 {formatBytes(grp.size * eligible.length)}
                </span>
                {grp.sameFolder && (
                  <span className="ml-2 rounded-full bg-butter px-2 py-0.5 text-xs font-bold" title="같은 폴더 안에서 번호만 다른 파일은 영상 프레임 같은 묶음일 수 있어서 기본으로 고르지 않았어요">
                    같은 폴더 안 · 일부러 둔 파일일 수 있어요
                  </span>
                )}
              </p>
              {eligible.length > 0 && (
                <button
                  onClick={() => onSetMany(eligible.map((f) => f.path), !allOn)}
                  className="rounded-full bg-cream px-3 py-1 text-sm font-semibold ring-1 ring-line hover:bg-line"
                >
                  {allOn ? "이 묶음 해제" : "남길 것 빼고 모두 선택"}
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grp.files.map((f) => {
                const isKeep = f.path === keep;
                const on = selected.has(f.path);
                return (
                  <div key={f.path} className={`flex gap-3 rounded-2xl p-2 ring-1 ${isKeep ? "bg-mint/40 ring-mint" : on ? "ring-2 ring-key-strong" : "ring-line"}`}>
                    <button onClick={() => setZoom(f)} className="shrink-0" title="크게 보기">
                      {isPicture(f.name) ? (
                        <Thumb path={f.path} className={`size-20 ${on ? "opacity-60" : ""}`} />
                      ) : (
                        <span className="grid size-20 place-items-center rounded-lg bg-line text-2xl">🎬</span>
                      )}
                    </button>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate font-semibold" title={f.name}>
                        {f.name}
                      </p>
                      <p className="truncate text-muted" title={showPath(f.folder)}>
                        {showPath(f.folder)}
                      </p>
                      <p className="text-muted">{day(f.time)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {isKeep ? (
                          <span className="rounded-full bg-mint px-2 py-0.5 font-bold text-mint-deep">✅ 남길 것</span>
                        ) : f.project ? (
                          <span className="rounded-full bg-sand px-2 py-0.5 font-bold">🔒 개발 프로젝트 · 보호</span>
                        ) : f.recent ? (
                          <span className="rounded-full bg-butter px-2 py-0.5 font-bold">🛡️ 최근 7일 · 보호</span>
                        ) : (
                          <label className="flex cursor-pointer items-center gap-1 font-semibold">
                            <input type="checkbox" checked={on} onChange={() => onToggle(f.path)} className="size-4 accent-mint-deep" />
                            지우기
                          </label>
                        )}
                        {!isKeep && (
                          <button
                            onClick={() => {
                              if (on) onToggle(f.path);
                              onKeep(grp.id, f.path);
                            }}
                            className="rounded-full px-2 py-0.5 font-semibold text-mint-deep ring-1 ring-mint hover:bg-mint/40"
                          >
                            이걸 남길게요
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {dupes.length > limit && (
        <button onClick={() => setLimit(limit + FIRST_SHOW)} className="w-full rounded-2xl bg-card py-2.5 text-sm font-semibold ring-1 ring-line hover:bg-line">
          {dupes.length - limit}묶음 더 보기
        </button>
      )}

      {zoom && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/70 p-4" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <div className="max-h-full w-full max-w-4xl overflow-auto rounded-3xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-bold">
                {showPath(zoom.folder)} › {zoom.name}
              </p>
              <button onClick={() => setZoom(null)} className="shrink-0 rounded-full bg-line px-4 py-1.5 text-sm font-bold hover:brightness-95">
                닫기
              </button>
            </div>
            {isPicture(zoom.name) ? (
              <Thumb path={zoom.path} className="mt-3 max-h-[75vh] w-full object-contain" />
            ) : (
              <p className="mt-6 text-center text-muted">영상은 미리보기가 없어요. 탐색기에서 열어 확인해 주세요.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
