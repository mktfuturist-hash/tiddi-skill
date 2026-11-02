import { guard } from "@/lib/server/guard";
import { getSettings, updateSettings } from "@/lib/server/settings";

// 지금 설정
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  return Response.json(await getSettings());
}

// 설정 바꾸기 ({ protectRecent: true | false })
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청을 읽지 못했어요" }, { status: 400 });
  }
  return Response.json(await updateSettings(body));
}
