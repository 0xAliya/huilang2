import type { Level, States } from '../engine/types';
import { levels } from '../levels';

const icons: Record<string, string> = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  reset: '<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/>',
  rotate: '<path d="M19 9a7 7 0 1 0 0 7m0-13v6h-6"/>',
  slide: '<path d="M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4"/>',
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h5v-7H4Zm16 0h2v7h-5v-7h3Z"/>',
  star: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.star}</svg>`;
const mark = '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m20 3 16 9v17l-16 9-16-9V12L20 3Z" stroke="currentColor" stroke-width="1.2"/><path d="m20 11 9 5v9l-9 5-9-5v-9l9-5Z" stroke="currentColor" stroke-width="1.2"/><path d="M20 11v19M4 12l16 9 16-9" stroke="currentColor" stroke-width="1.2"/></svg>';
type View = 'title' | 'select' | 'game' | 'complete';
export interface UIActions {
  start: () => void; select: () => void; home: () => void; choose: (n: number) => void;
  reset: () => void; mute: () => void; mechanism: (id: string) => void;
  hint: () => void; slider: (id: string, value: number, end: boolean) => void;
}
export class Interface {
  view: View = 'title';
  private level!: Level;
  private busy = false;
  private muted = false;
  private toastTimer = 0;
  constructor(readonly root: HTMLElement, private actions: UIActions) {}
  setMuted(muted: boolean) {
    this.muted = muted;
    const button = this.root.querySelector<HTMLButtonElement>('[data-action="mute"]');
    if (button) { button.innerHTML = icon(muted ? 'muted' : 'sound'); button.setAttribute('aria-label', muted ? '开启声音' : '静音'); button.setAttribute('aria-pressed', String(muted)); }
  }
  private header() {
    return `<header class="topbar">
      <button class="brand" data-action="home" aria-label="回廊首页">${mark}<span>回廊</span><span class="brand-en">HUI LANG</span></button>
      <div class="header-right"><span class="edition">${this.view === 'game' ? '行走于不可能之间' : '独立空间解谜 · VOL. 01'}</span>
      <button class="icon-button sound" data-action="mute" aria-label="${this.muted ? '开启声音' : '静音'}" aria-pressed="${this.muted}">${icon(this.muted ? 'muted' : 'sound')}</button></div>
    </header>`;
  }
  render(view: View, unlocked: number, level = levels[0], completed = false) {
    this.view = view; this.level = level;
    document.body.dataset.view = view;
    let body = '';
    if (view === 'title') body = `
      <main class="hero">
        <p class="eyebrow"><span></span> 一场关于视角的安静旅程</p>
        <h1>回廊<span class="title-dot">。</span></h1>
        <p class="english-title">THE SILENT CORRIDOR</p>
        <div class="short-rule"></div>
        <p class="hero-copy">转动时光的棱角，<br>让不相连的路，在目光中重逢。</p>
        <div class="hero-actions"><button class="primary" data-action="start">${unlocked > 1 && !completed ? '继续旅程' : '开始旅程'}${icon('arrow')}</button>
        <button class="text-button" data-action="select">选择章节 <span>↗</span></button></div>
      </main>
      <div class="scene-caption"><span class="tiny-diamond">◇</span><span>初阶</span><i></i><span>每一段归途，都始于一次转动</span></div>
      <aside class="vertical-note">ARCHITECTURE OF THE IMPOSSIBLE</aside>
      <footer class="landing-footer"><span>${icon('headphones')}戴上耳机，听见建筑的呼吸</span><span class="footer-count"><b>01 — 03</b> 三座回廊 · 一场旅程</span></footer>`;
    if (view === 'select') body = `
      <main class="chapter-select panel">
        <p class="eyebrow">THE JOURNEY</p><h1>沿途的风景</h1><p class="muted">每一次转动，都是一种新的可能。</p>
        <div class="chapter-cards">${levels.map((l, i) => `
          <button class="chapter-card chapter-${i + 1}" data-level="${i}" ${i >= unlocked ? 'disabled' : ''}>
            <span class="card-top"><span>CHAPTER 0${i + 1}</span>${i >= unlocked ? icon('lock') : icon('arrow')}</span>
            <span class="chapter-art"><span class="art-gate"></span><span class="art-step"></span><span class="art-step second"></span><span class="art-sun"></span></span>
            <span class="card-title"><b>0${i + 1}</b><strong>${l.name}</strong></span>
            <span class="card-description">${l.description}</span>
            <span class="card-bottom">${i >= unlocked ? '完成前一章后开启' : (i + 1 < unlocked || completed) ? '已走过 · 再次启程' : '等待你的足迹'}</span>
          </button>`).join('')}</div>
        <button class="text-button" data-action="home">${icon('back')} 返回首页</button>
      </main>`;
    if (view === 'game') body = `
      <div class="game-toolbar"><button class="icon-button" data-action="select" aria-label="返回选关">${icon('back')}</button><span>第 ${['一', '二', '三'][level.id - 1]} 章</span><button class="icon-button" data-action="reset" aria-label="重置本关">${icon('reset')}</button></div>
      <section class="chapter-heading"><p class="eyebrow">CHAPTER 0${level.id} <span class="heading-line"></span></p><h1>${level.name}</h1><p>${level.subtitle}</p><button class="hint-button" data-action="hint">${icon('star')} 一点灵感</button></section>
      <div class="game-bottom">
        <p class="status" id="status" role="status" aria-live="polite">点击石阶，向光而行</p>
        <div class="mechanism-dock">${level.mechanisms.map(m => `
          <div class="mechanism-control">
            <button class="mechanism-button" data-mechanism="${m.id}" aria-label="${m.type === 'rotate' ? '旋转' : '移动'}${m.label}">${icon(m.type)}<span>${m.label}</span>${m.type === 'rotate' ? '<span class="angle">90°</span>' : ''}</button>
            ${m.type === 'slide' ? `<input aria-label="拖动${m.label}" data-slider="${m.id}" type="range" min="0" max="${m.stops!.at(-1)}" step="0.01" value="${m.stops![m.initial]}">` : `<div class="state-dots" data-dots="${m.id}">${Array.from({ length: m.states }, (_, i) => `<i class="${i === m.initial ? 'active' : ''}"></i>`).join('')}</div>`}
          </div>`).join('')}</div>
        <p class="control-caption">${level.id === 1 ? '点击石阶行走 · 点击或拖动金色转轮' : level.id === 2 ? '站上桥端随柱转动 · 相连的目光，也是一条路' : '拖动滑杆搭乘渡台 · 点击转轮改变方向'}</p>
      </div><div class="chapter-progress">${levels.map(l => `<span class="${l.id === level.id ? 'current' : ''}">0${l.id}</span>`).join('<i></i>')}</div>`;
    if (view === 'complete') body = `
      <main class="completion panel"><div class="completion-symbol">${mark}</div><p class="eyebrow">A JOURNEY, REMEMBERED</p>
        <h1>曲径，终相逢。</h1><p>你让三座回廊重新相连。<br>愿每一次换个角度，都能看见新的路。</p>
        <div class="completion-chapters"><span>01 初阶</span><i>·</i><span>02 错位</span><i>·</i><span>03 潮汐</span></div>
        <button class="primary" data-action="select">重访回廊${icon('arrow')}</button><button class="text-button" data-action="home">返回首页</button>
      </main>`;
    this.root.innerHTML = `${this.header()}${body}<div id="toast" class="toast" role="status" aria-live="polite"></div><div class="edge-label">回廊 / 原创空间解谜</div>`;
    this.bind();
  }
  private bind() {
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.addEventListener('click', () => {
      const action = b.dataset.action as keyof UIActions;
      if (this.busy && action !== 'mute') return;
      (this.actions[action] as () => void)();
    }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(b => b.addEventListener('click', () => {
      if (!this.busy) this.actions.choose(Number(b.dataset.level));
    }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-mechanism]').forEach(b => b.addEventListener('click', () => {
      if (!this.busy) this.actions.mechanism(b.dataset.mechanism!);
    }));
    this.root.querySelectorAll<HTMLInputElement>('[data-slider]').forEach(input => {
      input.addEventListener('input', () => this.actions.slider(input.dataset.slider!, Number(input.value), false));
      input.addEventListener('change', () => this.actions.slider(input.dataset.slider!, Number(input.value), true));
      input.addEventListener('pointercancel', () => this.actions.slider(input.dataset.slider!, Number(input.value), true));
    });
  }
  setBusy(busy: boolean, dragging?: string) {
    this.busy = busy;
    this.root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(b => {
      if (b.dataset.action === 'mute' || (dragging && b.dataset.slider === dragging)) return;
      b.disabled = busy;
    });
  }
  update(states: States, operations: number) {
    for (const m of this.level.mechanisms) {
      this.root.querySelectorAll(`[data-dots="${m.id}"] i`).forEach((dot, i) => dot.classList.toggle('active', i === states[m.id]));
      const input = this.root.querySelector<HTMLInputElement>(`[data-slider="${m.id}"]`);
      if (input) input.value = String(m.stops![states[m.id]]);
    }
    const status = this.root.querySelector('#status');
    if (status) status.textContent = operations ? `已转动 ${operations} 次 · 点击石阶，向光而行` : '点击石阶，向光而行';
  }
  status(text: string) {
    const el = this.root.querySelector('#status'); if (el) el.textContent = text;
  }
  toast(text: string, duration = 4500) {
    const el = this.root.querySelector('#toast')!;
    el.textContent = text; el.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), duration);
  }
}
