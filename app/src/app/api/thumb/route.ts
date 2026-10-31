import { promises as fsp } from "node:fs";
import path from "node:path";
import { guard } from "@/lib/server/guard";
import { isOldPicture } from "@/lib/server/old";
import { isKnownPicture } from "@/lib/server/pairs";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

// 짝 찾기 · 같은 사진 · 오래된 파일 목록에 들어 있는 사진만 보여 줘요. 아무 경로나 넣는다고 내 파일이 열리지 않아요.
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const file = new URL(request.url).searchParams.get("p") ?? "";
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !((await isKnownPicture(file)) || (await isOldPicture(file)))) {
    return new Response("보여 줄 수 없는 파일이에요", { status: 404 });
  }
  try {
    // 내 사진 경로는 실행 중에 정해져요 (위에서 짝 결과에 든 사진인지 확인했어요)
    const body = await fsp.readFile(/*turbopackIgnore: true*/ file);
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch {
    return new Response("파일을 찾지 못했어요", { status: 404 });
  }
}
