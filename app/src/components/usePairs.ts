"use client";

import { useCallback, useEffect, useState } from "react";
import type { PairsStatus } from "@/lib/pair-types";

// TIDDI 서버에서 스크린샷 짝 찾기 상태 · 결과를 받아 와요
export function usePairs() {
  const [pairs, setPairs] = useState<PairsStatus | null>(null);

  const refresh = useCallback(() => {
    return fetch("/api/pairs", { cache: "no-store" })
      .then((r) => r.json() as Promise<PairsStatus>)
      .then(setPairs)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 서버가 꺼져 있어서 못 받았으면 3초마다 다시, 잠들어 있던 창을 다시 보면 바로 새로 불러와요
  const missing = pairs === null;
  useEffect(() => {
    if (!missing) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [missing, refresh]);

  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, [refresh]);

  const running = pairs?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(refresh, 800);
    return () => clearInterval(timer);
  }, [running, refresh]);

  const findPairs = useCallback(() => {
    return fetch("/api/pairs", { method: "POST" })
      .then((r) => r.json() as Promise<PairsStatus>)
      .then(setPairs)
      .catch(() => undefined);
  }, []);

  return { pairs, findPairs, refresh };
}

export function thumbUrl(path: string) {
  return `/api/thumb?p=${encodeURIComponent(path)}`;
}
