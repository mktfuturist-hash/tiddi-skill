import { guard } from "@/lib/server/guard";
import { getPairs, startPairs } from "@/lib/server/pairs";

// 짝 찾기 상태 · 마지막 결과
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  return Response.json(await getPairs());
}

// 짝 찾기 시작 (읽기만 해요)
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  await startPairs();
  return Response.json(await getPairs());
}
