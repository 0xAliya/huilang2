import type { Level } from '../engine/types';
export const second: Level = {
  id: 2, name: '错位', subtitle: '目光所至，远近相连。',
  description: '有些距离，只存在于另一个视角。',
  hint: ['先走上转柱的金色桥端，再转动机关。', '搭乘桥端转过两个直角，让远处的路在眼前相接。', '沿着视觉上相连的石阶，走向青色光门。'],
  minimum: 2, start: 'start', goal: 'goal',
  palette: { top: '#d7e6cf', side: '#75aaa0', accent: '#b48f50', dark: '#32635b', background: ['#e9eee2', '#d5e5df'] },
  tiles: [
    { id: 'start', at: [-1, 0, 2], support: 3 },
    { id: 'shore', at: [-1, 0, 1], support: 3 },
    { id: 'rider', at: [-1, 0, 0], mechanism: 'spire' },
    { id: 'far', at: [4, 2, 2], support: 2 },
    { id: 'gate', at: [5, 2, 2], support: 2 },
    { id: 'goal', at: [6, 2, 2], support: 2 },
  ],
  edges: [
    { from: 'start', to: 'shore' },
    { from: 'shore', to: 'rider', when: { spire: 0 } },
    { from: 'rider', to: 'far', kind: 'illusion', when: { spire: 2 } },
    { from: 'far', to: 'gate' }, { from: 'gate', to: 'goal' },
  ],
  mechanisms: [{ id: 'spire', label: '寻光转柱', type: 'rotate', pivot: [0, 0, 0], states: 4, initial: 0 }],
};
