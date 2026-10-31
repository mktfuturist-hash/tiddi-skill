// TIDDI 서버는 내 파일을 다뤄요. 그래서 TIDDI 화면 말고는 아무도 부르지 못하게 막아요.
// (다른 웹사이트가 내 브라우저를 통해 127.0.0.1로 몰래 요청하는 것도 여기서 막혀요)

import { touch } from "./idle";

const PORT = 3737;
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ORIGINS = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);

export function guard(request: Request): Response | null {
  const host = request.headers.get("host") ?? "";
  if (!HOSTS.has(host)) {
    return Response.json({ error: "TIDDI는 이 컴퓨터에서만 열 수 있어요" }, { status: 403 });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return Response.json({ error: "다른 사이트에서 온 요청은 받지 않아요" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin && !ORIGINS.has(origin)) {
    return Response.json({ error: "다른 사이트에서 온 요청은 받지 않아요" }, { status: 403 });
  }
  touch();
  return null;
}
