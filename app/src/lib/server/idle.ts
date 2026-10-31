// TIDDI 창이 하나도 없으면 서버가 스스로 꺼져요.
// 열린 창은 1분마다 /api/ping으로 「아직 있어요」 신호를 보내고, 모든 /api 요청이 신호로 쳐요.

type Globals = {
  __tiddiSeen?: number;
  __tiddiIdleTimer?: ReturnType<typeof setInterval>;
  __tiddiScan?: { status: string };
  __tiddiPairs?: { status: string };
  __tiddiTrashBusy?: boolean;
};

const g = globalThis as unknown as Globals;

export function touch() {
  g.__tiddiSeen = Date.now();
}

// 훑기 · 짝 찾기 · 휴지통 작업 중에는 끄지 않아요
function working() {
  return g.__tiddiScan?.status === "running" || g.__tiddiPairs?.status === "running" || g.__tiddiTrashBusy === true;
}

export function startIdleWatch(minutes: number) {
  if (g.__tiddiIdleTimer) return;
  touch();
  g.__tiddiIdleTimer = setInterval(() => {
    const quiet = Date.now() - (g.__tiddiSeen ?? 0);
    if (quiet > minutes * 60_000 && !working()) {
      console.log(`[TIDDI] ${minutes}분 동안 열린 창이 없어서 서버를 꺼요`);
      process.exit(0);
    }
  }, 30_000);
}
