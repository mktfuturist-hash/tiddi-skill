import type { MapDir } from "./scan-types";

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

// 「용량 먹는 곳」: C:\ 바로 아래(Users 빼고) + 내 사용자 폴더 바로 아래에서 큰 순서
export function topSpots(tree: MapDir, home: string, count = 3): MapDir[] {
  const homeNode = findNode(tree, home);
  const top = (tree.children ?? []).filter((c) => !same(c.path, "C:\\Users"));
  return [...top, ...(homeNode?.children ?? [])].sort((a, b) => b.size - a.size).slice(0, count);
}
