import type { MapDir, ScanResult } from "./scan-types";

function same(a: string, b: string) {
  return a.toLowerCase().replace(/\\+$/, "") === b.toLowerCase().replace(/\\+$/, "");
}

export function findNode(node: MapDir, target: string): MapDir | null {
  if (same(node.path, target)) return node;
  const t = target.toLowerCase();
  for (const child of node.children ?? []) {
    if (t.startsWith(child.path.toLowerCase())) {
      const hit = findNode(child, target);
      if (hit) return hit;
    }
  }
  return null;
}

// 「용량 먹는 곳」: 시스템 드라이브는 C:\ 바로 아래(Users 빼고) + 내 사용자 폴더 바로 아래, 다른 드라이브는 드라이브 바로 아래에서 큰 순서
export function topSpots(result: ScanResult, count = 3): MapDir[] {
  const spots: MapDir[] = [];
  for (const d of result.drives) {
    if (d.system) {
      const homeNode = findNode(d.tree, result.home);
      spots.push(...(d.tree.children ?? []).filter((c) => !same(c.path, `${d.letter}:\\Users`)), ...(homeNode?.children ?? []));
    } else {
      // 다른 드라이브는 이름 앞에 드라이브 글자를 붙여 헷갈리지 않게 해요
      spots.push(...(d.tree.children ?? []).map((c) => ({ ...c, name: `${d.letter}: ${c.name}` })));
    }
  }
  return spots.sort((a, b) => b.size - a.size).slice(0, count);
}
