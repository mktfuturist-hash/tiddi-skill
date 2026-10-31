import { guard } from "@/lib/server/guard";
import { getScan, startScan } from "@/lib/server/scan";

// 지금 상태 (남은 용량 · 훑는 중인지 · 마지막 결과)
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  return Response.json(await getScan());
}

// 훑기 시작 (읽기만 해요)
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  await startScan();
  return Response.json(await getScan());
}
