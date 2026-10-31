"use client";

import { useCallback, useEffect, useState } from "react";
import type { HistoryEntry, Refused } from "@/lib/trash-types";

type TrashResult = { entry: HistoryEntry | null; refused: Refused[] };
type RestoreResult = { restored: number; refused: Refused[] };

async function post<T>(body: object): Promise<T> {
  const res = await fetch("/api/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "요청이 실패했어요");
  return data as T;
}

// 휴지통 보내기 · 되살리기 · 지운 기록
export function useTrash() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const refresh = useCallback(() => {
    return fetch("/api/trash", { cache: "no-store" })
      .then((r) => r.json() as Promise<HistoryEntry[]>)
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const trash = useCallback(
    async (paths: string[]) => {
      const result = await post<TrashResult>({ action: "trash", paths });
      await refresh();
      return result;
    },
    [refresh],
  );

  const restore = useCallback(
    async (id: string) => {
      const result = await post<RestoreResult>({ action: "restore", id });
      await refresh();
      return result;
    },
    [refresh],
  );

  return { history, trash, restore };
}
