"use client";

import { useState } from "react";
import { driveName } from "@/lib/drive-types";
import { formatBytes } from "@/lib/format";
import type { OldFile } from "@/lib/old-types";
import { defaultDupPicks, type DupGroup } from "@/lib/pair-types";
import { RECON } from "@/lib/mode";
import type { HistoryEntry, Refused } from "@/lib/trash-types";
import DoneView from "./DoneView";
import Gauge from "./Gauge";
import HelpView from "./HelpView";
import HistoryView from "./HistoryView";
import Logo from "./Logo";
import OldFilesView from "./OldFilesView";
import PairsView, { type DupTab } from "./PairsView";
import { FirstRun, Scanning } from "./StartViews";
import StorageMap from "./StorageMap";
import TrashModal, { type TrashPlan } from "./TrashModal";
import TypeBar from "./TypeBar";
import { useHeartbeat } from "./useHeartbeat";
import { usePairs } from "./usePairs";
import { useScan } from "./useScan";
import { useTrash } from "./useTrash";

type View = "home" | "dupes" | "old" | "history" | "help" | "done";

const NAV: Array<[View, string]> = [
  ["home", "홈"],
  ["dupes", "중복 정리"],
  ["old", "오래된 파일"],
  ["history", "지운 기록"],
  ["help", "도움말"],
];

const sum = (list: Array<{ size: number }>) => list.reduce((a, s) => a + s.size, 0);

function when(ms: number) {
  return new Date(ms).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// 팝업에서 「전체 화면으로」 열 때 #old · #dupes 로 바로 그 화면을 열어요
function firstView(): View {
  if (typeof window === "undefined") return "home";
  const hash = window.location.hash.slice(1);
  return hash === "old" || hash === "dupes" ? hash : "home";
}

// 같은 사진 여러 벌에서 기본으로 고를 파일 (남길 것을 바꿨으면 그 기준으로)
function dupDefaults(dupes: DupGroup[], keeps: Record<string, string>) {
  return dupes.flatMap((g) => defaultDupPicks({ ...g, keep: keeps[g.id] ?? g.keep }));
}

export default function TiddiApp() {
  useHeartbeat();
  const { status, offline, start, refresh: refreshScan } = useScan();
  const { pairs: pairsStatus, findPairs, refresh: refreshPairs } = usePairs();
  const { history, trash, restore } = useTrash();
  const [view, setView] = useState<View>(firstView);
  const [tab, setTab] = useState<DupTab>("pair");
  // 처음엔 짝 있는 원본 + 다른 폴더에 있는 같은 사진을 체크해 둬요 (유일본 · 보호 파일은 빼고). 손대면 그때부터 내 선택을 따라가요
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [keeps, setKeeps] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<TrashPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [done, setDone] = useState<{ entry: HistoryEntry | null; refused: Refused[] } | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oldKey, setOldKey] = useState(0);
  // 홈에서 보고 있는 드라이브 (없으면 시스템 드라이브)
  const [driveTab, setDriveTab] = useState<string | null>(null);

  const found = pairsStatus?.result ?? null;
  const pairList = found?.pairs ?? [];
  const uniqueList = found?.uniques ?? [];
  const dupes = found?.dupes ?? [];
  const safePairs = pairList.filter((s) => !s.recent);
  const dupPicks = dupDefaults(dupes, keeps);
  const selected = chosen ?? new Set([...safePairs.map((s) => s.path), ...dupPicks.map((f) => f.path)]);
  const keepSet = new Set(dupes.map((g) => keeps[g.id] ?? g.keep));
  const dupFiles = dupes.flatMap((g) => g.files).filter((f) => !f.project && !f.recent && !keepSet.has(f.path));
  const picked = [...pairList.filter((s) => !s.recent), ...uniqueList.filter((s) => !s.recent), ...dupFiles].filter((s) => selected.has(s.path));
  const finding = pairsStatus?.status === "running";

  const result = status?.result ?? null;
  const drives = status?.drives ?? [];
  // 윈도우가 깔린 드라이브(보통 C)가 기본이고, 위쪽 탭으로 다른 드라이브를 골라 봐요
  const sysDrive = drives.find((d) => d.system) ?? drives[0] ?? null;
  const shown = drives.find((d) => d.letter === driveTab) ?? sysDrive;
  const shownScan = result?.drives.find((d) => d.letter === shown?.letter) ?? null;
  const scanningDrive = drives.find((d) => d.letter === status?.progress.drive) ?? sysDrive;
  const running = status?.status === "running";
  const ready = !!result && !running;

  const go = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setChosen(next);
  };

  const setMany = (paths: string[], on: boolean) => {
    const next = new Set(selected);
    for (const p of paths) {
      if (on) next.add(p);
      else next.delete(p);
    }
    setChosen(next);
  };

  const keep = (groupId: string, path: string) => {
    setKeeps({ ...keeps, [groupId]: path });
    const next = new Set(selected);
    next.delete(path);
    setChosen(next);
  };

  const confirmTrash = async () => {
    if (RECON || !plan) return;
    setBusy(true);
    setTrashError(null);
    try {
      const res = await trash(plan.paths);
      const gone = new Set(res.entry?.items.map((s) => s.path) ?? []);
      setChosen(new Set([...selected].filter((p) => !gone.has(p))));
      setDone(res);
      setPlan(null);
      setOldKey(oldKey + 1);
      await Promise.all([refreshPairs(), refreshScan()]);
      go("done");
    } catch (e) {
      setTrashError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const undo = async (id: string) => {
    setUndoingId(id);
    try {
      const res = await restore(id);
      setOldKey(oldKey + 1);
      await Promise.all([refreshPairs(), refreshScan()]);
      setNotice(
        res.refused.length
          ? `${res.restored}개를 되살렸어요. ${res.refused.length}개는 되살리지 못했어요: ${res.refused[0].reason}`
          : `${res.restored}개를 원래 자리로 되살렸어요.`,
      );
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setUndoingId(null);
    }
  };

  const findingNote = finding && (
    <p className="text-sm text-ink/70">
      {pairsStatus.progress.stage || "찾는 중"} {pairsStatus.progress.count && `· ${pairsStatus.progress.count}`}
    </p>
  );

  const dupBytes = sum(dupPicks);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <button onClick={() => go("home")}>
            <Logo />
          </button>
          {ready && (
            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => go(key)}
                  className={`rounded-full px-3 py-1.5 font-semibold transition ${view === key ? "bg-ink text-white" : "hover:bg-line"}`}
                >
                  {label}
                  {key === "history" && history.length > 0 && <span className="ml-1 text-xs opacity-70">{history.length}</span>}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
        {RECON && <p className="inline-block rounded-full bg-key/60 px-3 py-1 text-xs font-bold text-key-ink">👀 정찰 모드 · 보여 주기만 하고 아무것도 지우지 않아요</p>}

        {notice && (
          <p className="flex items-center justify-between gap-2 rounded-2xl bg-key/50 px-4 py-3 text-sm">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="font-bold">
              ✕
            </button>
          </p>
        )}
        {offline && <p className="rounded-2xl bg-peach/60 px-4 py-3 text-sm">TIDDI 서버에 연결하지 못했어요. 바탕화면 TIDDI 아이콘을 다시 더블클릭해 주세요.</p>}
        {status?.status === "error" && (
          <p className="rounded-2xl bg-peach/60 px-4 py-3 text-sm">
            훑다가 문제가 생겼어요: {status.error}{" "}
            <button onClick={start} className="font-bold underline">
              다시 훑기
            </button>
          </p>
        )}
        {pairsStatus?.status === "error" && (
          <p className="rounded-2xl bg-peach/60 px-4 py-3 text-sm">
            짝 찾기에서 문제가 생겼어요: {pairsStatus.error}{" "}
            <button onClick={findPairs} className="font-bold underline">
              다시 찾기
            </button>
          </p>
        )}

        {!status && !offline && <p className="py-20 text-center text-muted">불러오는 중…</p>}

        {status && !ready && (
          <>
            {sysDrive && <Gauge label={driveName(sysDrive)} total={sysDrive.total} free={sysDrive.free} />}
            {running ? (
              <Scanning
                files={status.progress.files}
                bytes={status.progress.bytes}
                used={scanningDrive ? scanningDrive.total - scanningDrive.free : 0}
                current={status.progress.current}
                drive={status.progress.drive}
                step={drives.length > 1 ? status.progress.step : ""}
              />
            ) : (
              <FirstRun onScan={start} />
            )}
          </>
        )}

        {ready && view === "home" && (
          <>
            {drives.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {drives.map((d) => {
                  const on = shown?.letter === d.letter;
                  return (
                    <button
                      key={d.letter}
                      onClick={() => setDriveTab(d.letter)}
                      className={`rounded-2xl px-4 py-2 text-left text-sm ring-1 transition ${on ? "bg-ink text-white ring-ink" : "bg-card ring-line hover:bg-line"}`}
                    >
                      <span className="block font-bold">
                        {d.manage ? "" : "👀 "}
                        {driveName(d)}
                      </span>
                      <span className={`block text-xs ${on ? "text-white/70" : "text-muted"}`}>
                        {formatBytes(d.free)} 남음 / {formatBytes(d.total)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {shown && <Gauge label={driveName(shown)} total={shown.total} free={shown.free} />}
            {shown && !shown.manage && <p className="rounded-2xl bg-sky/50 px-4 py-3 text-sm">👀 {shown.reason}. 용량만 보여 드려요.</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted">
              <span>
                마지막으로 훑은 때 {when(result.scannedAt)} · 파일 {result.files.toLocaleString("ko-KR")}개 · {Math.round(result.durationMs / 1000)}초 걸림
              </span>
              <button onClick={start} className="rounded-full bg-card px-3 py-1 font-semibold text-ink ring-1 ring-line hover:bg-line">
                다시 훑기
              </button>
            </div>
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-key/40 p-6 ring-1 ring-key">
              <div>
                <p className="text-sm font-semibold">① 중복 정리</p>
                {found ? (
                  <>
                    <p className="mt-1 text-2xl font-extrabold">바로 비울 수 있는 중복 {formatBytes(sum(safePairs) + dupBytes)}</p>
                    <p className="mt-1 text-sm text-ink/70">
                      스크린샷 짝 {safePairs.length.toLocaleString("ko-KR")}장 · 같은 사진 여러 벌 {dupPicks.length.toLocaleString("ko-KR")}개 · 묶음마다 하나는 남겨요
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-2xl font-extrabold">아직 중복을 찾지 않았어요</p>
                )}
                {findingNote}
              </div>
              {found ? (
                <button onClick={() => go("dupes")} className="rounded-full bg-key px-6 py-3 font-bold text-key-ink ring-1 ring-key-strong hover:brightness-95">
                  중복 보러 가기
                </button>
              ) : (
                <button
                  disabled={finding}
                  onClick={findPairs}
                  className="rounded-full bg-key px-6 py-3 font-bold text-key-ink ring-1 ring-key-strong hover:brightness-95 disabled:opacity-50"
                >
                  {finding ? "찾는 중…" : "중복 찾기 시작"}
                </button>
              )}
            </section>
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-card p-6 ring-1 ring-line">
              <div>
                <p className="text-sm font-semibold">② 오래된 파일</p>
                <p className="mt-1 text-lg font-extrabold">오랫동안 안 고친 큰 파일을 크기 순서로 보여 줘요</p>
                <p className="mt-1 text-sm text-muted">다운로드 · 바탕 화면 · 문서에 쌓인 설치 파일, 압축 파일, 예전 영상부터 보면 좋아요</p>
              </div>
              <button onClick={() => go("old")} className="rounded-full bg-cream px-6 py-3 font-bold ring-1 ring-line hover:bg-line">
                오래된 파일 보기
              </button>
            </section>
            {shown && shownScan ? (
              <>
                <StorageMap
                  key={shown.letter}
                  tree={shownScan.tree}
                  used={shown.total - shown.free}
                  system={shown.system}
                  onOpenPairs={() => go("dupes")}
                />
                <TypeBar types={shownScan.types} />
              </>
            ) : (
              shown?.manage && (
                <p className="rounded-2xl bg-card px-4 py-6 text-center text-sm text-muted ring-1 ring-line">
                  {shown.letter} 드라이브는 아직 훑지 않았어요. 위의 「다시 훑기」를 누르면 지도가 생겨요.
                </p>
              )
            )}
          </>
        )}

        {ready && view === "dupes" && !found && (
          <section className="rounded-3xl bg-card px-6 py-10 text-center ring-1 ring-line">
            <p className="text-5xl">🔍</p>
            <h2 className="mt-3 text-2xl font-extrabold">{finding ? "중복을 찾는 중이에요" : "아직 중복을 찾지 않았어요"}</h2>
            <p className="mt-2 text-muted">스크린샷 짝과 내용이 똑같은 사진 · 영상을 찾아요. 읽기만 해요.</p>
            {finding ? (
              <div className="mt-4">{findingNote}</div>
            ) : (
              <button onClick={findPairs} className="mt-6 rounded-full bg-key px-8 py-3.5 text-lg font-bold text-key-ink hover:brightness-95">
                중복 찾기 시작
              </button>
            )}
          </section>
        )}

        {ready && view === "dupes" && found && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted">
              <span>
                찾은 때 {when(found.foundAt)} · 스크린샷 {found.shotCount.toLocaleString("ko-KR")}장 · 내 사진 {found.scanned.toLocaleString("ko-KR")}장 ·{" "}
                {Math.round(found.durationMs / 1000)}초
              </span>
              <button
                disabled={finding}
                onClick={findPairs}
                className="rounded-full bg-card px-3 py-1 font-semibold text-ink ring-1 ring-line hover:bg-line disabled:opacity-50"
              >
                {finding ? "다시 찾는 중…" : "다시 찾기"}
              </button>
            </div>
            <PairsView
              pairs={pairList}
              uniques={uniqueList}
              dupes={dupes}
              keeps={keeps}
              onKeep={keep}
              tab={tab}
              onTab={setTab}
              selected={selected}
              onToggle={toggle}
              onSetMany={setMany}
              picked={{ paths: picked.map((s) => s.path), bytes: sum(picked) }}
              onTrash={() => {
                setTrashError(null);
                setPlan({
                  kind: "dupes",
                  paths: picked.map((s) => s.path),
                  bytes: sum(picked),
                  uniqueCount: uniqueList.filter((s) => selected.has(s.path)).length,
                });
              }}
            />
          </>
        )}

        {ready && view === "old" && (
          <OldFilesView
            reloadKey={oldKey}
            onScan={start}
            onTrash={(items: OldFile[]) => {
              setTrashError(null);
              setPlan({ kind: "old", paths: items.map((f) => f.path), bytes: sum(items), uniqueCount: 0 });
            }}
          />
        )}

        {ready && view === "done" && done && (
          <DoneView
            count={done.entry?.items.length ?? 0}
            bytes={done.entry?.bytes ?? 0}
            refused={done.refused}
            undoing={undoingId !== null}
            onUndo={async () => {
              if (done.entry && (await undo(done.entry.id))) go("home");
            }}
            onHome={() => go("home")}
          />
        )}

        {ready && view === "history" && <HistoryView history={history} busyId={undoingId} onUndo={undo} />}
        {ready && view === "help" && <HelpView />}
      </main>

      {plan && !RECON && <TrashModal plan={plan} busy={busy} error={trashError} onCancel={() => setPlan(null)} onConfirm={confirmTrash} />}
    </div>
  );
}
