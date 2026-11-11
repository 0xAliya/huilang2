import './ui/style.css';
import { World } from './render/world';
import { Interface } from './ui/interface';
import { Sound } from './audio/sound';
import { levels } from './levels';
import { active, findPath, initialStates, nextState, operate, snapStop, tilePosition } from './engine/graph';
import { walkPosition } from './engine/projection';
import { solve } from './engine/solver';
import type { Snapshot } from './engine/types';

function readProgress() {
  try {
    const data = JSON.parse(localStorage.getItem('huilang:progress:v1') ?? '{}');
    return { unlocked: Number.isInteger(data.unlocked) ? Math.min(3, Math.max(1, data.unlocked)) : 1, completed: data.completed === true };
  } catch { return { unlocked: 1, completed: false }; }
}
let progress = readProgress(), index = 0, level = levels[0];
let snapshot: Snapshot = { node: level.start, states: initialStates(level) };
let busy = false, operations = 0;
let dragging: { id: string; value: number } | null = null;
const sound = new Sound();
document.addEventListener('pointerdown', () => { void sound.unlock().catch(() => {}); }, { once: true });
document.addEventListener('keydown', () => { void sound.unlock().catch(() => {}); }, { once: true });

const world = new World(document.querySelector<HTMLCanvasElement>('#world')!);
const ui = new Interface(document.querySelector('#ui')!, {
  start: () => start(progress.completed ? 0 : progress.unlocked - 1),
  select: () => show('select'),
  home: () => show('title'),
  choose: n => { if (n < progress.unlocked) start(n); },
  reset: () => start(index),
  mute: () => ui.setMuted(sound.toggle()),
  mechanism: id => { void turn(id); },
  hint: hint,
  slider: (id, value, end) => { void slide(id, value, end); },
});
ui.setMuted(sound.muted);
function setBusy(value: boolean, slider?: string) { busy = value; ui.setBusy(value, slider); }
function show(view: 'title' | 'select' | 'complete') {
  if (busy) return;
  world.load(levels[0], { bridge: 0 }, view);
  ui.render(view, progress.unlocked, level, progress.completed);
}
function start(n: number) {
  if (busy) return;
  index = n; level = levels[n]; operations = 0; dragging = null;
  snapshot = { node: level.start, states: initialStates(level) };
  world.load(level, snapshot.states, 'game');
  ui.render('game', progress.unlocked, level, progress.completed);
  ui.update(snapshot.states, operations);
}
function position(node = snapshot.node) {
  return tilePosition(level.tiles.find(t => t.id === node)!, level, snapshot.states);
}
async function walk(to: string) {
  if (busy || ui.view !== 'game') return;
  const path = findPath(level, snapshot.node, to, snapshot.states);
  if (!path) { world.flash(to); sound.fail(); ui.toast('这条路还未相连，试着转动机关。', 2500); return; }
  if (path.length < 2) return;
  setBusy(true);
  ui.status('旅人正在前行…');
  for (const next of path.slice(1)) {
    const fromPos = position(), toPos = position(next);
    const edge = level.edges.find(e => active(e, snapshot.states) &&
      ((e.from === snapshot.node && e.to === next) || (e.to === snapshot.node && e.from === next)))!;
    sound.step();
    await world.animate(390, t => world.placeCharacter(walkPosition(fromPos, toPos, t, edge.kind === 'illusion'), Math.sin(t * Math.PI) * .07));
    snapshot.node = next; world.placeCharacter(toPos);
  }
  ui.update(snapshot.states, operations);
  if (snapshot.node === level.goal) await win();
  else setBusy(false);
}
async function turn(id: string) {
  if (busy || ui.view !== 'game') return;
  const m = level.mechanisms.find(m => m.id === id)!;
  const before = snapshot.states[id], after = nextState(m, before);
  const next = operate(level, snapshot, id, after, busy);
  if (!next) return;
  setBusy(true); ui.status('石阶缓缓转动…'); sound.mechanism(after);
  await world.animateMechanism(id, before, after, snapshot.node);
  snapshot = next; operations++;
  world.sync(snapshot.states); world.placeCharacter(position());
  ui.update(snapshot.states, operations); setBusy(false);
  if (findPath(level, snapshot.node, level.goal, snapshot.states)) ui.status('归途已相连 · 点击光门前的石阶');
}
async function slide(id: string, value: number, end: boolean) {
  if (ui.view !== 'game' || (busy && !dragging)) return;
  if (dragging && dragging.id !== id) return;
  const m = level.mechanisms.find(m => m.id === id)!;
  if (!dragging) { dragging = { id, value }; setBusy(true, id); }
  value = Math.max(m.stops![0], Math.min(m.stops!.at(-1)!, value));
  dragging.value = value; world.previewSlide(id, value, snapshot.node);
  ui.status('松开滑杆，让渡台停靠');
  if (!end) return;
  const target = snapStop(m.stops!, value);
  dragging = null; setBusy(true);
  await world.settleSlide(id, value, target, snapshot.node);
  if (target !== snapshot.states[id]) { operations++; sound.mechanism(target); }
  snapshot.states = { ...snapshot.states, [id]: target };
  world.sync(snapshot.states); world.placeCharacter(position());
  ui.update(snapshot.states, operations); setBusy(false);
}
async function win() {
  sound.win(); ui.status('回廊已相连');
  progress.unlocked = Math.min(3, Math.max(progress.unlocked, index + 2));
  if (index === 2) progress.completed = true;
  try { localStorage.setItem('huilang:progress:v1', JSON.stringify(progress)); } catch { ui.toast('浏览器未允许存档，本次旅程仍可继续。'); }
  await world.celebrate();
  setBusy(false);
  if (index < 2) { start(index + 1); ui.toast(`抵达第${['一', '二', '三'][index]}章 · ${level.name}`, 2400); }
  else show('complete');
}
function hint() {
  if (busy) return;
  const solution = solve(level, snapshot);
  if (!solution?.actions.length) return;
  const first = solution.actions[0];
  if (first.kind === 'operate') {
    const m = level.mechanisms.find(m => m.id === first.id)!;
    ui.toast(m.type === 'rotate' ? `转动「${m.label}」一次，让脚下的路改变方向。` : `将「${m.label}」移向${first.state ? '右' : '左'}端。站在渡台上可以一同移动。`);
  } else {
    let last = first.to;
    for (const action of solution.actions) {
      if (action.kind !== 'walk') break;
      last = action.to;
    }
    world.flash(last);
    ui.toast(last === level.goal ? '路已经相连，点击光门前的石阶。' : '先点击闪光的石阶，站上机关后再转动它。');
  }
}
world.onPick = pick => {
  if (ui.view !== 'game') return;
  if (pick.mechanism) void turn(pick.mechanism);
  else if (pick.tile) void walk(pick.tile);
};
world.onDrag = (id, pixels, end) => {
  if (ui.view !== 'game') return;
  const m = level.mechanisms.find(m => m.id === id)!;
  if (m.type === 'rotate') { if (end && Math.abs(pixels) > 8) void turn(id); }
  else {
    const value = m.stops![snapshot.states[id]] + pixels / world.slidePixelLength(id) * m.stops!.at(-1)!;
    void slide(id, value, end);
  }
};
show('title');
// Read-only diagnostics for real pointer-driven browser acceptance tests.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __huilang: {
      snapshot: () => ({ view: ui.view, level: level.id, node: snapshot.node, states: { ...snapshot.states }, busy, operations }),
      solution: () => solve(level, snapshot),
      tile: (id: string) => world.screenTile(id),
      mechanism: (id: string) => world.screenMechanism(id),
      tiles: () => level.tiles.map(t => ({ id: t.id, ...world.screenTile(t.id) })),
    },
  });
}
