import type { OldGroup } from "@/lib/file-kinds";
import { guard } from "@/lib/server/guard";
import { queryOld } from "@/lib/server/old";

const GROUPS = new Set<OldGroup | "all">(["all", "media", "doc", "install", "etc"]);

// 오래된 파일 목록 (?months=12&min=10&group=all&drive=all)
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const q = new URL(request.url).searchParams;
  const months = Math.max(6, Math.min(120, Number(q.get("months")) || 12));
  const minMB = Math.max(1, Math.min(10_000, Number(q.get("min")) || 10));
  const raw = (q.get("group") ?? "all") as OldGroup | "all";
  const group = GROUPS.has(raw) ? raw : "all";
  const d = (q.get("drive") ?? "all").toUpperCase();
  const drive = /^[A-Z]$/.test(d) ? d : "all";
  return Response.json(await queryOld({ months, minMB, group, drive }));
}
