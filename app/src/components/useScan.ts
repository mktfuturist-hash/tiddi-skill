"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScanStatus } from "@/lib/scan-types";

// TIDDI 서버에서 남은 용량 · 훑기 상태 · 마지막 결과를 받아 와요
export function useScan() {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(() => {
    return fetch("/api/scan", { cache: "no-store" })
      .then((r) => r.json() as Promise<ScanStatus>)
      .then((s) => {
        setStatus(s);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 서버가 꺼져 있으면 3초마다 다시 연결해 봐요 (바탕화면 아이콘으로 다시 켜면 이 창이 스스로 살아나요)
  useEffect(() => {
    if (!offline) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [offline, refresh]);

  // 잠들어 있던 창을 다시 보면 바로 새로 불러와요
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [refresh]);

  // 훑는 동안에는 진행 상황을 자주 물어봐요
  const running = status?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(refresh, 800);
    return () => clearInterval(timer);
  }, [running, refresh]);

  const start = useCallback(() => {
    return fetch("/api/scan", { method: "POST" })
      .then((r) => r.json() as Promise<ScanStatus>)
      .then(setStatus)
      .catch(() => setOffline(true));
  }, []);

  return { status, offline, start, refresh };
}
