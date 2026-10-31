// 서버가 켜질 때 한 번 실행돼요.
// 바탕화면 아이콘으로 켰을 때만(TIDDI_IDLE_MINUTES가 있을 때) 「창을 다 닫으면 자동 종료」를 켜요.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const minutes = Number(process.env.TIDDI_IDLE_MINUTES);
  if (!minutes || minutes <= 0) return;
  const { startIdleWatch } = await import("./lib/server/idle");
  startIdleWatch(minutes);
}
