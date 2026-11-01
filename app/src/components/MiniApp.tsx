"use client";

import { useEffect, useState } from "react";
import { isPicture } from "@/lib/file-kinds";
import { formatBytes } from "@/lib/format";
import { topSpots } from "@/lib/map-utils";
import { RECON } from "@/lib/mode";
import type { OldResult } from "@/lib/old-types";
import { defaultDupPicks } from "@/lib/pair-types";
import type { HistoryEntry, Refused } from "@/lib/trash-types";
import Logo from "./Logo";
import Thumb from "./Thumb";
import { useHeartbeat } from "./useHeartbeat";
import { usePairs } from "./usePairs";
import { useScan } from "./useScan";
import { useTrash } from "./useTrash";

const LOW = 10 * 1024 ** 3;
const sum = (list: Array<{ size: number }>) => list.reduce((a, s) => a + s.size, 0);

type Stage = "idle" | "confirm" | "done";

// 바탕화면 아이콘을 더블클릭하면 뜨는 작은 창이에요
export default function MiniApp() {
  useHeartbeat();
  const { status, offline, start, refresh: refreshScan } = useScan();
  const { pairs: pairsStatus, findPairs, refresh: refreshPairs } = usePairs();
  const { trash, restore } = useTrash();
  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ entry: HistoryEntry | null; refused: Refused[] } | null>(null);
  const [old, setOld] = useState<OldResult | null>(null);
  const [oldKey, setOldKey] = useState(0);

  const drive = status?.drive ?? { total: 0, free: 0 };
  const used = drive.total - drive.free;
  const pct = drive.total ? (used / drive.total) * 100 : 0;
  const low = drive.free < LOW;
  const result = status?.result ?? null;
  const running = status?.status === "running";
  const spots = result ? topSpots(result.tree, result.home) : [];

  // 팝업에서는 「확실한 중복」만 한 번에 정리해요: 사본이 있는 스크린샷 원본 + 다른 폴더에 있는 같은 사진 (최근 7일 · 프로젝트 파일 빼고)
  const found = pairsStatus?.result ?? null;
  const finding = pairsStatus?.status === "running";
  const pairs = (found?.pairs ?? []).filter((s) => !s.recent);
  const dupPicks = (found?.dupes ?? []).flatMap(defaultDupPicks);
  const items = [...pairs.map((s) => ({ path: s.path, name: s.name, size: s.size })), ...dupPicks.map((f) => ({ path: f.path, name: f.name, size: f.size }))];
  const bytes = sum(items);

  useEffect(() => {
    let alive = true;
    fetch("/api/old?months=12&min=10&group=all", { cache: "no-store" })
      .then((r) => r.json() as Promise<OldResult>)
      .then((d) => {
        if (alive) setOld(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [oldKey, result?.scannedAt]);

  const openFull = (hash = "") => window.open(`/${hash}`, "tiddi-full", "popup,width=1280,height=860");

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await trash(items.map((s) => s.path));
      setDone(res);
      setStage("done");
      await Promise.all([refreshPairs(), refreshScan()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!done?.entry) return;
    setBusy(true);
    try {
      await restore(done.entry.id);
      await Promise.all([refreshPairs(), refreshScan()]);
      setOldKey(oldKey + 1);
      setDone(null);
      setStage("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col gap-3 px-4 py-4">
      <header className="flex items-center justify-between">
        <Logo small />
        <button onClick={() => openFull()} className="rounded-full px-3 py-1 text-sm font-semibold hover:bg-line">
          전체 화면으로 ↗
        </button>
      </header>

      {RECON && <p className="self-start rounded-full bg-key/60 px-3 py-1 text-[11px] font-bold text-key-ink">👀 정찰 모드 · 아무것도 지우지 않아요</p>}
      {offline && <p className="rounded-2xl bg-peach/60 px-4 py-3 text-sm">TIDDI 서버에 연결하지 못했어요. 바탕화면 아이콘을 다시 더블클릭해 주세요.</p>}
      {error && <p className="rounded-2xl bg-peach/60 px-4 py-3 text-sm">{error}</p>}

      <section className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line">
        <p className="text-xs font-semibold text-muted">C 드라이브</p>
        <p className="mt-0.5 text-4xl font-extrabold tracking-tight">
          <span className={low ? "text-coral" : "text-mint-deep"}>{status ? formatBytes(drive.free) : "…"}</span>
          <span className="ml-1.5 text-xl font-bold">남음</span>
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gradient-to-r from-key to-key-strong transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {status && (
          <p className="mt-1.5 text-xs text-muted">
            전체 {formatBytes(drive.total)} 중 {formatBytes(used)} 사용 중
          </p>
        )}
      </section>

      {stage === "idle" && (
        <section className="rounded-3xl bg-key/40 p-5 ring-1 ring-key">
          <p className="text-xs font-semibold">① 중복 정리</p>
          {found ? (
            items.length > 0 ? (
              <>
                <p className="mt-1 text-xl font-extrabold leading-snug">
                  바로 비울 수 있는 중복
                  <br />
                  {items.length.toLocaleString("ko-KR")}개 · {formatBytes(bytes)}
                </p>
                <p className="mt-1 text-xs text-ink/70">
                  스크린샷 짝 {pairs.length}장 · 같은 사진 여러 벌 {dupPicks.length}개 · 묶음마다 하나는 남겨요
                </p>
                <div className="mt-3 flex -space-x-3">
                  {items
                    .filter((s) => isPicture(s.name))
                    .slice(0, 6)
                    .map((s) => (
                      <Thumb key={s.path} path={s.path} className="aspect-[4/3] w-14 shadow-sm ring-2 ring-card" />
                    ))}
                  {items.length > 6 && (
                    <span className="grid aspect-[4/3] w-14 place-items-center rounded-lg bg-card text-xs font-bold ring-1 ring-line">+{items.length - 6}</span>
                  )}
                </div>
                <button
                  onClick={() => setStage("confirm")}
                  className="mt-4 w-full rounded-full bg-key px-4 py-3 font-bold text-key-ink ring-1 ring-key-strong hover:brightness-95"
                >
                  미리 보고 정리하기
                </button>
                <button onClick={() => openFull("#dupes")} className="mt-2 w-full text-xs font-semibold text-mint-deep hover:underline">
                  하나씩 골라서 정리하기 ↗
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 text-xl font-extrabold">바로 지울 중복이 없어요 ✨</p>
                <button onClick={() => openFull("#dupes")} className="mt-2 text-xs font-semibold text-mint-deep hover:underline">
                  같은 폴더 안 중복 · 유일본 보러 가기 ↗
                </button>
              </>
            )
          ) : (
            <>
              <p className="mt-1 text-xl font-extrabold">아직 중복을 찾지 않았어요</p>
              {finding && (
                <p className="mt-1 text-xs text-ink/70">
                  {pairsStatus.progress.stage} {pairsStatus.progress.count && `· ${pairsStatus.progress.count}`}
                </p>
              )}
              <button
                disabled={finding}
                onClick={findPairs}
                className="mt-4 w-full rounded-full bg-key px-4 py-3 font-bold text-key-ink ring-1 ring-key-strong hover:brightness-95 disabled:opacity-50"
              >
                {finding ? "찾는 중…" : "중복 찾기 시작 (1분쯤)"}
              </button>
            </>
          )}
        </section>
      )}

      {stage === "confirm" && (
        <section className="rounded-3xl bg-card p-5 shadow-sm ring-2 ring-key-strong">
          <p className="text-lg font-extrabold">
            {items.length.toLocaleString("ko-KR")}개 · {formatBytes(bytes)}를 휴지통으로 보내요
          </p>
          <div className="mt-3 grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
            {items.map((s) =>
              isPicture(s.name) ? (
                <Thumb key={s.path} path={s.path} className="aspect-[4/3] w-full" />
              ) : (
                <span key={s.path} className="grid aspect-[4/3] place-items-center rounded-lg bg-line" title={s.name}>
                  🎬
                </span>
              ),
            )}
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            <li>✅ 스크린샷은 원본만, 같은 사진은 묶음마다 하나를 남겨요.</li>
            <li>✅ 휴지통에서 언제든 되살릴 수 있어요.</li>
            <li>☁️ OneDrive 파일은 웹 · 폰에서도 같이 사라져요 (30일 동안 되살리기 가능).</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={() => setStage("idle")} className="flex-1 rounded-full bg-line px-4 py-2.5 font-bold hover:brightness-95 disabled:opacity-50">
              취소
            </button>
            <button
              disabled={RECON || busy}
              onClick={send}
              className="flex-1 rounded-full bg-key px-4 py-2.5 font-bold text-key-ink ring-1 ring-key-strong hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {RECON ? "정찰 모드" : busy ? "보내는 중…" : "휴지통으로"}
            </button>
          </div>
        </section>
      )}

      {stage === "done" && done && (
        <section className="rounded-3xl bg-card px-5 py-6 text-center shadow-sm ring-1 ring-line">
          <p className="text-4xl">✨</p>
          <p className="mt-2 text-3xl font-extrabold text-mint-deep">{formatBytes(done.entry?.bytes ?? 0)} 확보!</p>
          <p className="mt-1 text-xs text-muted">
            휴지통에 {done.entry?.items.length ?? 0}개가 들어 있어요{done.refused.length > 0 && ` · ${done.refused.length}개는 안전 확인에서 건너뛰었어요`}
          </p>
          <p className="mt-1 text-[11px] text-muted">윈도우 휴지통을 비우면 용량이 생겨요</p>
          <div className="mt-4 flex justify-center gap-2">
            {done.entry && (
              <button disabled={busy} onClick={undo} className="rounded-full bg-line px-4 py-2 text-sm font-bold hover:brightness-95 disabled:opacity-50">
                {busy ? "되살리는 중…" : "↩︎ 되돌리기"}
              </button>
            )}
            <button onClick={() => setStage("idle")} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:brightness-110">
              확인
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-card p-5 ring-1 ring-line">
        <p className="text-xs font-semibold">② 오래된 파일</p>
        {old && old.scannedAt !== null ? (
          <>
            <p className="mt-1 text-lg font-extrabold leading-snug">
              1년 넘게 안 고친 10MB 이상
              <br />
              {old.total.toLocaleString("ko-KR")}개 · {formatBytes(old.bytes)}
            </p>
            <button onClick={() => openFull("#old")} className="mt-3 w-full rounded-full bg-cream px-4 py-2.5 text-sm font-bold ring-1 ring-line hover:bg-line">
              골라서 정리하기 ↗
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">「다시 훑기」를 한 번 하면 보여요</p>
        )}
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">용량 먹는 곳 TOP 3</p>
          {result && (
            <button onClick={() => openFull()} className="text-xs font-semibold text-mint-deep hover:underline">
              지도 보기
            </button>
          )}
        </div>
        {running && <p className="mt-3 text-sm text-muted">훑는 중… {status ? formatBytes(status.progress.bytes) : ""}</p>}
        {!running && status && (
          <button onClick={start} className="mt-3 w-full rounded-full bg-cream px-4 py-2 text-xs font-bold ring-1 ring-line hover:bg-line">
            {result ? "다시 훑기 (1~3분)" : "내 컴퓨터 훑기 (1~3분)"}
          </button>
        )}
        {!running && result && (
          <ul className="mt-3 space-y-2.5">
            {spots.map((n) => (
              <li key={n.path}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-semibold" title={n.path}>
                    {n.locked ? "🔒 " : ""}
                    {n.name}
                  </span>
                  <span className="shrink-0 text-muted">{formatBytes(n.size)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-key-strong" style={{ width: `${drive.total ? (n.size / drive.total) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
