import type { Edge, Level, Mechanism, Snapshot, States, Tile, Vec3 } from './types';

export const initialStates = (level: Level): States =>
  Object.fromEntries(level.mechanisms.map(m => [m.id, m.initial]));
export const active = (edge: Edge, states: States) =>
  Object.entries(edge.when ?? {}).every(([id, value]) => states[id] === value);
export function neighbors(level: Level, node: string, states: States): string[] {
  return level.edges.filter(e => active(e, states) && (e.from === node || e.to === node))
    .map(e => e.from === node ? e.to : e.from);
}
export function findPath(level: Level, from: string, to: string, states: States): string[] | null {
  const queue = [from], previous = new Map<string, string | null>([[from, null]]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (node === to) {
      const result = [node];
      while (previous.get(result[0])) result.unshift(previous.get(result[0])!);
      return result;
    }
    for (const next of neighbors(level, node, states)) {
      if (!previous.has(next)) { previous.set(next, node); queue.push(next); }
    }
  }
  return null;
}
export function tilePosition(tile: Tile, level: Level, states: States): Vec3 {
  if (!tile.mechanism) return [...tile.at];
  return transformed(tile.at, level.mechanisms.find(m => m.id === tile.mechanism)!, states[tile.mechanism]);
}
export function transformed(at: Vec3, mechanism: Mechanism, state: number): Vec3 {
  const [x, y, z] = at;
  if (mechanism.type === 'slide') {
    const distance = mechanism.stops![state];
    return at.map((v, i) => v + mechanism.pivot[i] + mechanism.axis![i] * distance) as Vec3;
  }
  const angle = state * Math.PI / 2, c = Math.cos(angle), s = Math.sin(angle);
  return [
    mechanism.pivot[0] + Math.round(x * c + z * s),
    mechanism.pivot[1] + y,
    mechanism.pivot[2] + Math.round(-x * s + z * c),
  ];
}
export function nextState(m: Mechanism, state: number) { return (state + 1) % m.states; }
export function snapStop(stops: number[], value: number) {
  return stops.reduce((best, stop, i) =>
    Math.abs(stop - value) < Math.abs(stops[best] - value) ? i : best, 0);
}
export function operate(level: Level, snapshot: Snapshot, id: string, state: number, busy: boolean): Snapshot | null {
  const m = level.mechanisms.find(m => m.id === id);
  if (busy || !m || state < 0 || state >= m.states || state === snapshot.states[id]) return null;
  if (m.type === 'rotate' && state !== nextState(m, snapshot.states[id])) return null;
  return { node: snapshot.node, states: { ...snapshot.states, [id]: state } };
}
