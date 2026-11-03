export const headerEdges = ['straight', 'wave', 'diagonal', 'arc', 'chevron'] as const;

export type HeaderEdge = (typeof headerEdges)[number];

export const headerEdgeLabels: Record<HeaderEdge, string> = {
  straight: 'Gerade',
  wave: 'Welle',
  diagonal: 'Schräge',
  arc: 'Bogen',
  chevron: 'Spitze',
};

type EdgePoint = readonly [number, number];

export const headerEdgeShapes: Record<
  Exclude<HeaderEdge, 'straight'>,
  { kind: 'C' | 'Q' | 'L'; points: readonly EdgePoint[] }
> = {
  wave: {
    kind: 'C',
    points: [
      [0, 65],
      [220, 115],
      [600, -15],
      [1000, 25],
    ],
  },
  diagonal: {
    kind: 'L',
    points: [
      [0, 100],
      [1000, 0],
    ],
  },
  arc: {
    kind: 'Q',
    points: [
      [0, 0],
      [500, 180],
      [1000, 0],
    ],
  },
  chevron: {
    kind: 'L',
    points: [
      [0, 0],
      [500, 100],
      [1000, 0],
    ],
  },
};

export const headerEdgePaths = Object.fromEntries(
  Object.entries(headerEdgeShapes).map(([id, { kind, points }]) => [
    id,
    `M${points[0].join(' ')} ${
      kind === 'L'
        ? points
            .slice(1)
            .map((point) => `L${point.join(' ')}`)
            .join(' ')
        : `${kind}${points
            .slice(1)
            .map((point) => point.join(' '))
            .join(' ')}`
    } V100 H0 Z`,
  ]),
) as Record<Exclude<HeaderEdge, 'straight'>, string>;

export function canMirrorHeaderEdge(edge: HeaderEdge): boolean {
  return edge === 'wave' || edge === 'diagonal';
}
