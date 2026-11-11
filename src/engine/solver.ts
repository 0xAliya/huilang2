import { initialStates, neighbors, nextState } from './graph';
import type { Action, Level, Snapshot } from './types';
export interface Solution { operations: number; actions: Action[] }
// 0–1 BFS: walking costs 0, each discrete mechanism operation costs 1.
export function solve(level: Level, initial?: Snapshot): Solution | null {
  const start = initial ?? { node: level.start, states: initialStates(level) };
  const key = (s: Snapshot) => `${s.node}|${level.mechanisms.map(m => s.states[m.id]).join(',')}`;
  const distance = new Map([[key(start), 0]]);
  const previous = new Map<string, { key: string; action: Action }>();
  const queue: { snapshot: Snapshot; cost: number }[] = [{ snapshot: start, cost: 0 }];
  while (queue.length) {
    const { snapshot, cost } = queue.shift()!;
    const currentKey = key(snapshot);
    if (cost !== distance.get(currentKey)) continue;
    if (snapshot.node === level.goal) {
      const actions: Action[] = [];
      let cursor = currentKey;
      while (previous.has(cursor)) {
        const p = previous.get(cursor)!; actions.unshift(p.action); cursor = p.key;
      }
      return { operations: cost, actions };
    }
    const choices: { snapshot: Snapshot; action: Action; weight: number }[] =
      neighbors(level, snapshot.node, snapshot.states).map(to => ({
        snapshot: { ...snapshot, node: to }, action: { kind: 'walk', to }, weight: 0,
      }));
    for (const m of level.mechanisms) {
      const targets = m.type === 'rotate' ? [nextState(m, snapshot.states[m.id])] :
        Array.from({ length: m.states }, (_, i) => i).filter(i => i !== snapshot.states[m.id]);
      for (const state of targets) choices.push({
        snapshot: { ...snapshot, states: { ...snapshot.states, [m.id]: state } },
        action: { kind: 'operate', id: m.id, state }, weight: 1,
      });
    }
    for (const c of choices) {
      const k = key(c.snapshot), nextCost = cost + c.weight;
      if (nextCost < (distance.get(k) ?? Infinity)) {
        distance.set(k, nextCost);
        previous.set(k, { key: currentKey, action: c.action });
        const item = { snapshot: c.snapshot, cost: nextCost };
        if (c.weight) queue.push(item); else queue.unshift(item);
      }
    }
  }
  return null;
}
