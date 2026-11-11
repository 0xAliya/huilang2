import { describe, expect, it } from 'vitest';
import { active, findPath, initialStates, nextState, operate, snapStop, tilePosition } from '../src/engine/graph';
import { project, STEP, virtualEndpoint, walkPosition } from '../src/engine/projection';
import { solve } from '../src/engine/solver';
import { levels } from '../src/levels';
import type { States } from '../src/engine/types';

function configurations(index: number): States[] {
  let result: States[] = [{}];
  for (const m of levels[index].mechanisms) result = result.flatMap(s =>
    Array.from({ length: m.states }, (_, n) => ({ ...s, [m.id]: n })));
  return result;
}
describe('行走与机关', () => {
  it('可达、不可达和条件边', () => {
    const l = levels[0];
    expect(findPath(l, l.start, 'shore', { bridge: 0 })).toEqual(['start', 'shore']);
    expect(findPath(l, l.start, l.goal, { bridge: 0 })).toBeNull();
    expect(findPath(l, l.start, l.goal, { bridge: 1 })).toHaveLength(8);
    expect(findPath(l, l.start, l.goal, { bridge: 2 })).toBeNull();
    expect(findPath(l, l.start, l.start, { bridge: 0 })).toEqual([l.start]);
  });
  it('旋转按四态循环，禁止行走时操作与跨态跳转', () => {
    const l = levels[0], m = l.mechanisms[0], s = { node: l.start, states: initialStates(l) };
    expect(nextState(m, 3)).toBe(0);
    expect(operate(l, s, m.id, 1, true)).toBeNull();
    expect(operate(l, s, m.id, 2, false)).toBeNull();
    expect(operate(l, s, m.id, 1, false)?.states).toEqual({ bridge: 1 });
    expect(s.states.bridge).toBe(0);
  });
  it('滑台吸附最近停靠点，包括边界与平局', () => {
    expect(snapStop([0, 3], -.1)).toBe(0);
    expect(snapStop([0, 3], 1.49)).toBe(0);
    expect(snapStop([0, 3], 1.5)).toBe(0);
    expect(snapStop([0, 3], 1.51)).toBe(1);
    expect(snapStop([0, 3], 9)).toBe(1);
  });
  it('角色节点不变，坐标随旋转和滑台移动', () => {
    const l = levels[1], t = l.tiles.find(t => t.id === 'rider')!;
    const s = operate(l, { node: t.id, states: { spire: 0 } }, 'spire', 1, false)!;
    expect(s.node).toBe(t.id);
    expect(tilePosition(t, l, s.states)).toEqual([0, 0, 1]);
    expect(tilePosition(t, l, { spire: 2 })).toEqual([1, 0, 0]);
    const ferry = levels[2].tiles.find(t => t.id === 'ferry')!;
    const returning = levels[2].tiles.find(t => t.id === 'return')!;
    expect(tilePosition(ferry, levels[2], { tide: 1, spire: 0 })).toEqual([0, 0, 0]);
    expect(tilePosition(returning, levels[2], { tide: 1, spire: 0 })).toEqual([0, -2, -1]);
  });
});
describe.each(levels)('关卡 $id「$name」', level => {
  it(`可通关，最少 ${level.minimum} 次操作`, () => {
    const solution = solve(level)!;
    expect(solution).not.toBeNull();
    expect(solution.operations).toBe(level.minimum);
    let state = { node: level.start, states: initialStates(level) };
    for (const action of solution.actions) {
      if (action.kind === 'walk') {
        expect(findPath(level, state.node, action.to, state.states)).not.toBeNull();
        state = { ...state, node: action.to };
      } else {
        const next = operate(level, state, action.id, action.state, false);
        expect(next).not.toBeNull(); state = next!;
      }
    }
    expect(state.node).toBe(level.goal);
    console.log(`第 ${level.id} 关最优解 (${solution.operations} 次):`, solution.actions);
  });
  it('初始状态不操作机关无法抵达终点', () => {
    expect(findPath(level, level.start, level.goal, initialStates(level))).toBeNull();
  });
  it('每种机关状态下，实体边真正相邻，幻径恰好投影为一格', () => {
    for (const states of configurations(level.id - 1)) {
      for (const edge of level.edges.filter(e => active(e, states))) {
        const a = tilePosition(level.tiles.find(t => t.id === edge.from)!, level, states);
        const b = tilePosition(level.tiles.find(t => t.id === edge.to)!, level, states);
        if (edge.kind === 'illusion') {
          const pa = project(a), pb = project(b);
          expect(Math.abs(Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) - STEP)).toBeLessThan(.001);
          const virtual = virtualEndpoint(a, b), pv = project(virtual);
          expect(Math.hypot(pv[0] - pb[0], pv[1] - pb[1])).toBeLessThan(.001);
          // Check both directions around the exact depth-switch frame.
          for (const [from, to] of [[a, b], [b, a]]) {
            const before = project(walkPosition(from, to, .5 - 1e-7, true));
            const after = project(walkPosition(from, to, .5 + 1e-7, true));
            expect(Math.hypot(before[0] - after[0], before[1] - after[1])).toBeLessThan(.001);
          }
        } else expect(a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0)).toBe(1);
      }
    }
  });
  it('所有格子为整数且所有状态没有节点重叠', () => {
    for (const states of configurations(level.id - 1)) {
      const positions = level.tiles.map(t => tilePosition(t, level, states));
      expect(positions.every(p => p.every(Number.isInteger))).toBe(true);
      expect(new Set(positions.map(p => p.join(','))).size).toBe(positions.length);
    }
  });
});
