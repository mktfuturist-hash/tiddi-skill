"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/format";
import type { DirKind, MapDir } from "@/lib/scan-types";
import { squarify } from "@/lib/treemap";
import { noteForDir, TONE_BG, toneForDir, type Tone } from "./tones";

const BOX = { x: 0, y: 0, w: 160, h: 100 };
const GB = 1024 ** 3;

type Tile = { id: string; name: string; size: number; tone: Tone; locked: boolean; note: string; node?: MapDir; files?: number; kind?: DirKind };

function tilesFor(node: MapDir, isRoot: boolean, unaccounted: number): Tile[] {
  const tiles: Tile[] = (node.children ?? []).map((c, i) => ({
    id: c.path,
    name: c.name,
    size: c.size,
    tone: toneForDir(c, i),
    locked: c.locked,
    note: noteForDir(c),
    node: c.children?.length ? c : undefined,
    files: c.files,
    kind: c.kind,
  }));
  if (node.rest) {
    tiles.push({ id: `${node.path}|rest`, name: `작은 폴더 ${node.rest.count}개`, size: node.rest.size, tone: "sand", locked: node.locked, note: "20MB보다 작은 폴더들을 묶었어요" });
  }
  if (node.own > 0 && isRoot) {
    // C:\ 바로 아래 파일은 대부분 pagefile.sys · hiberfil.sys예요
    tiles.push({
      id: `${node.path}|own`,
      name: "시스템 파일",
      size: node.own,
      tone: "sand",
      locked: true,
      note: "가상 메모리(pagefile) · 최대 절전(hiberfil) 파일이에요. 보기만 해요. 컴퓨터를 다시 시작하면 가상 메모리가 줄어들기도 해요",
    });
  } else if (node.own > 0) {
    tiles.push({ id: `${node.path}|own`, name: "이 폴더의 파일", size: node.own, tone: "sand", locked: node.locked, note: "하위 폴더가 아니라 여기 바로 들어 있는 파일들이에요" });
  }
  if (isRoot && unaccounted > GB) {
    tiles.push({
      id: "unaccounted",
      name: "확인 못 한 곳",
      size: unaccounted,
      tone: "sand",
      locked: true,
      note: "가상 메모리 · 최대 절전 파일, 권한이 없는 폴더, 복원 지점 등이에요. 보기만 해요",
    });
  }
  return tiles.filter((t) => t.size > 0);
}

export default function StorageMap({ tree, used, onOpenPairs }: { tree: MapDir; used: number; onOpenPairs: () => void }) {
  const [trail, setTrail] = useState<MapDir[]>([]);
  const [picked, setPicked] = useState<Tile | null>(null);
  const here = trail.length ? trail[trail.length - 1] : tree;
  const tiles = squarify(tilesFor(here, trail.length === 0, used - tree.size), BOX);

  const open = (tile: Tile) => {
    if (tile.node) {
      setTrail([...trail, tile.node]);
      setPicked(null);
    } else {
      setPicked(tile);
    }
  };

  const goTo = (depth: number) => {
    setTrail(trail.slice(0, depth));
    setPicked(null);
  };

  const hereNote = noteForDir(here);

  return (
    <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">용량 지도</h2>
        <p className="text-xs text-muted">칸이 클수록 많이 차지해요 · 🔒는 보기만</p>
      </div>
      <nav className="mt-2 flex flex-wrap items-center gap-1 text-sm">
        <button className="rounded-full px-2 py-0.5 font-semibold hover:bg-line" onClick={() => goTo(0)}>
          C 드라이브
        </button>
        {trail.map((p, i) => (
          <span key={p.path} className="flex items-center gap-1">
            <span className="text-muted">›</span>
            <button className="rounded-full px-2 py-0.5 font-semibold hover:bg-line" onClick={() => goTo(i + 1)}>
              {p.name}
            </button>
          </span>
        ))}
      </nav>
      <div className="relative mt-3 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-line">
        {tiles.map((t) => {
          const roomy = t.rect.w * t.rect.h > 260;
          return (
            <button
              key={t.id}
              onClick={() => open(t)}
              title={`${t.name} · ${formatBytes(t.size)}`}
              className={`absolute flex flex-col items-start justify-start border-2 border-card p-2 text-left transition hover:brightness-95 ${TONE_BG[t.tone]} ${picked?.id === t.id ? "ring-2 ring-mint-deep ring-inset" : ""}`}
              style={{ left: `${t.rect.x / 1.6}%`, top: `${t.rect.y}%`, width: `${t.rect.w / 1.6}%`, height: `${t.rect.h}%` }}
            >
              {roomy && (
                <>
                  <span className="block max-w-full truncate text-xs font-bold sm:text-sm">
                    {t.locked ? "🔒 " : ""}
                    {t.name}
                    {t.node ? " ›" : ""}
                  </span>
                  <span className="block text-xs text-ink/70">{formatBytes(t.size)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 min-h-12 rounded-2xl bg-cream px-4 py-3 text-sm">
        {picked ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p>
                <b>
                  {picked.locked ? "🔒 " : ""}
                  {picked.name}
                </b>{" "}
                · {formatBytes(picked.size)}
                {picked.files !== undefined && <span className="text-muted"> · 파일 {picked.files.toLocaleString("ko-KR")}개</span>}
              </p>
              {picked.note && <p className="mt-0.5 text-muted">{picked.note}</p>}
            </div>
            {picked.kind === "screenshots" ? (
              <button onClick={onOpenPairs} className="rounded-full bg-key px-4 py-1.5 text-sm font-bold text-key-ink hover:brightness-95">
                짝 찾기로 가기
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted">
            {trail.length ? (
              <>
                <span className="font-semibold text-ink">{here.path}</span> · {formatBytes(here.size)}
                {hereNote && <span className="block">{hereNote}</span>}
              </>
            ) : (
              "› 표시가 있는 칸을 누르면 안쪽 폴더로 들어가요."
            )}
          </p>
        )}
      </div>
    </section>
  );
}
