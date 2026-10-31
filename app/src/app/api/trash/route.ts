import { guard } from "@/lib/server/guard";
import { getHistory, restoreEntry, sendToTrash } from "@/lib/server/trash";

// 지운 기록
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  return Response.json(await getHistory());
}

// { action: "trash", paths: [...] } 휴지통으로 보내기 · { action: "restore", id } 되살리기
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  let body: { action?: string; paths?: unknown; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청을 읽지 못했어요" }, { status: 400 });
  }
  try {
    if (body.action === "trash") return Response.json(await sendToTrash(body.paths));
    if (body.action === "restore") return Response.json(await restoreEntry(body.id));
    return Response.json({ error: "모르는 요청이에요" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
