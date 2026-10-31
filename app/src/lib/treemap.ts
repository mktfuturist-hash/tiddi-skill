export type Rect = { x: number; y: number; w: number; h: number };

type Weighted = { size: number };
type Node<T> = { item: T; area: number };

function worst<T>(row: Node<T>[], side: number): number {
  const sum = row.reduce((a, n) => a + n.area, 0);
  const max = Math.max(...row.map((n) => n.area));
  const min = Math.min(...row.map((n) => n.area));
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

// 큰 칸부터 정사각형에 가깝게 나눠 담아요 (squarified treemap)
export function squarify<T extends Weighted>(items: T[], box: Rect): Array<T & { rect: Rect }> {
  const total = items.reduce((a, i) => a + i.size, 0);
  if (total <= 0) return [];
  const scale = (box.w * box.h) / total;
  const nodes = [...items].sort((a, b) => b.size - a.size).map((item) => ({ item, area: item.size * scale }));
  const out: Array<T & { rect: Rect }> = [];
  let { x, y, w, h } = box;

  const place = (row: Node<T>[]) => {
    const sum = row.reduce((a, n) => a + n.area, 0);
    if (w >= h) {
      const cw = sum / h;
      let cy = y;
      for (const n of row) {
        const nh = n.area / cw;
        out.push({ ...n.item, rect: { x, y: cy, w: cw, h: nh } });
        cy += nh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (const n of row) {
        const nw = n.area / rh;
        out.push({ ...n.item, rect: { x: cx, y, w: nw, h: rh } });
        cx += nw;
      }
      y += rh;
      h -= rh;
    }
  };

  let row: Node<T>[] = [];
  for (const n of nodes) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, n], side) <= worst(row, side)) {
      row.push(n);
    } else {
      place(row);
      row = [n];
    }
  }
  if (row.length) place(row);
  return out;
}
