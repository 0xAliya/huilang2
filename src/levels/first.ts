import type { Level } from '../engine/types';
export const first: Level = {
  id: 1, name: '初阶', subtitle: '风起之处，断桥重逢。',
  description: '转动一座桥，寻回前行的方向。',
  hint: ['轻触金色转轮，让桥转过一个直角。', '桥已相连。点击光门前的石阶，旅人会自己寻路。'],
  minimum: 1, start: 'start', goal: 'goal',
  palette: { top: '#efd6c6', side: '#b8827d', accent: '#bc8257', dark: '#395e5b', background: ['#f2ece2', '#e5e8de'] },
  tiles: [
    { id: 'start', at: [-3, 0, 0], support: 3 },
    { id: 'shore', at: [-2, 0, 0], support: 3 },
    { id: 'bridge-a', at: [0, 0, -1], mechanism: 'bridge' },
    { id: 'bridge-b', at: [0, 0, 0], mechanism: 'bridge' },
    { id: 'bridge-c', at: [0, 0, 1], mechanism: 'bridge' },
    { id: 'far', at: [2, 0, 0], support: 3 },
    { id: 'gate', at: [3, 0, 0], support: 3 },
    { id: 'goal', at: [4, 0, 0], support: 3 },
  ],
  edges: [
    { from: 'start', to: 'shore' },
    { from: 'bridge-a', to: 'bridge-b' }, { from: 'bridge-b', to: 'bridge-c' },
    { from: 'shore', to: 'bridge-a', when: { bridge: 1 } },
    { from: 'bridge-c', to: 'far', when: { bridge: 1 } },
    { from: 'shore', to: 'bridge-c', when: { bridge: 3 } },
    { from: 'bridge-a', to: 'far', when: { bridge: 3 } },
    { from: 'far', to: 'gate' }, { from: 'gate', to: 'goal' },
  ],
  mechanisms: [{ id: 'bridge', label: '回转桥', type: 'rotate', pivot: [0, 0, 0], states: 4, initial: 0 }],
};
