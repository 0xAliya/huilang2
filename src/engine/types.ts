export type Vec3 = [number, number, number];
export type States = Record<string, number>;
export interface Tile {
  id: string;
  at: Vec3;
  mechanism?: string;
  support?: number;
}
export interface Edge {
  from: string;
  to: string;
  kind?: 'physical' | 'illusion';
  when?: States;
}
export interface Mechanism {
  id: string;
  label: string;
  type: 'rotate' | 'slide';
  pivot: Vec3;
  states: number;
  initial: number;
  axis?: Vec3;
  stops?: number[];
}
export interface Palette {
  top: string;
  side: string;
  accent: string;
  dark: string;
  background: [string, string];
}
export interface Level {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  hint: string[];
  minimum: number;
  start: string;
  goal: string;
  tiles: Tile[];
  edges: Edge[];
  mechanisms: Mechanism[];
  palette: Palette;
}
export interface Snapshot { node: string; states: States }
export type Action = { kind: 'walk'; to: string } | { kind: 'operate'; id: string; state: number };
