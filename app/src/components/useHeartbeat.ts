"use client";

import { useEffect } from "react";

// 창이 열려 있는 동안 1분마다 서버에 「아직 있어요」를 알려요. 창을 다 닫으면 서버가 10분 뒤 스스로 꺼져요
export function useHeartbeat() {
  useEffect(() => {
    const beat = () => fetch("/api/ping", { cache: "no-store" }).catch(() => undefined);
    const timer = setInterval(beat, 60_000);
    // 다시 보이는 순간에도 한 번 알려요 (잠들어 있던 창)
    const wake = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
}
