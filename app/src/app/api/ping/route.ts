import { guard } from "@/lib/server/guard";

// 열린 TIDDI 창이 「아직 있어요」라고 알리는 곳이에요 (guard가 신호를 기록해요)
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  return Response.json({ ok: true });
}
