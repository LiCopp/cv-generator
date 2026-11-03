import { canMirrorHeaderEdge, headerEdgeShapes, type HeaderEdge } from '@cv/core';

/**
 * Clip only decorative layers, leaving semantic header text and portrait flow intact.
 * Bézier curves use de Casteljau interpolation at the existing 65 sample points;
 * percentage x coordinates scale with A4 width while mm offsets retain physical depth.
 * Mirroring reverses contour traversal to keep a non-self-intersecting polygon.
 */
export function headerClipPath(edge: HeaderEdge, depthMm: number, mirrored: boolean): string {
  if (edge === 'straight') return 'none';
  const shape = headerEdgeShapes[edge];
  const points =
    shape.kind === 'L'
      ? shape.points
      : Array.from({ length: 65 }, (_, index) => {
          const t = index / 64;
          let remaining: (readonly [number, number])[] = [...shape.points];
          while (remaining.length > 1)
            remaining = remaining
              .slice(1)
              .map((point, i) => [
                remaining[i][0] * (1 - t) + point[0] * t,
                remaining[i][1] * (1 - t) + point[1] * t,
              ]);
          return remaining[0];
        });
  const reverse = mirrored && canMirrorHeaderEdge(edge);
  const contour = (reverse ? [...points] : [...points].reverse()).map(
    ([x, y]) =>
      `${((reverse ? 1000 - x : x) / 10).toFixed(6)}% calc(100% - ${(depthMm * (1 - y / 100)).toFixed(6)}mm)`,
  );
  return `polygon(0 0, 100% 0, ${contour.join(', ')})`;
}
