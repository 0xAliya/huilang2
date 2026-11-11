import type { Vec3 } from './types';
export const STEP = Math.sqrt(2 / 3);
export function project([x, y, z]: Vec3): [number, number] {
  return [(x - z) / Math.sqrt(2), (2 * y - x - z) / Math.sqrt(6)];
}
// Remove the view-direction component, choosing the nearest one-grid endpoint.
export function virtualEndpoint(from: Vec3, to: Vec3): Vec3 {
  const candidates: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  const target = project(to);
  const delta = candidates.reduce((best, next) => {
    const error = (v: Vec3) => {
      const p = project(from.map((n, i) => n + v[i]) as Vec3);
      return Math.hypot(p[0] - target[0], p[1] - target[1]);
    };
    return error(next) < error(best) ? next : best;
  });
  return from.map((n, i) => n + delta[i]) as Vec3;
}
export function walkPosition(from: Vec3, to: Vec3, progress: number, illusion: boolean): Vec3 {
  const virtual = illusion ? virtualEndpoint(from, to) : to;
  return from.map((v, i) =>
    v + (virtual[i] - v) * progress + (illusion && progress >= 0.5 ? to[i] - virtual[i] : 0)
  ) as Vec3;
}
