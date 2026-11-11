import { test, expect, type Page } from '@playwright/test';
import type { Action, Snapshot } from '../../src/engine/types';
declare global {
  interface Window {
    __huilang: {
      snapshot: () => Snapshot & { view: string; level: number; busy: boolean; operations: number };
      solution: () => { operations: number; actions: Action[] };
      tile: (id: string) => { x: number; y: number };
      mechanism: (id: string) => { x: number; y: number };
      tiles: () => { id: string; x: number; y: number }[];
    };
  }
}
const ready = async (page: Page) => expect.poll(() => page.evaluate(() => window.__huilang.snapshot().busy)).toBe(false);
async function clickTile(page: Page, id: string, touch: boolean) {
  const p = await page.evaluate(id => window.__huilang.tile(id), id);
  if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
}
test('真实点击通关三章，桌面和触屏画面及进度验收', async ({ page }, testInfo) => {
  const touch = testInfo.project.name === 'mobile';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('.hero h1')).toContainText('回廊');
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-title.png` });
  await page.getByRole('button', { name: '选择章节' }).click();
  await expect(page.locator('[data-level="1"]')).toBeDisabled();
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-chapters.png` });
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.getByRole('button', { name: '开始旅程' }).click();
  // Unreachable target feedback is exercised before changing any mechanism.
  await clickTile(page, 'far', touch);
  await expect(page.locator('#toast')).toContainText('还未相连');
  for (let chapter = 1; chapter <= 3; chapter++) {
    await expect.poll(() => page.evaluate(() => window.__huilang.snapshot().level)).toBe(chapter);
    await ready(page);
    await page.screenshot({ path: `artifacts/${testInfo.project.name}-level-${chapter}.png` });
    const points = await page.evaluate(() => window.__huilang.tiles());
    const viewport = page.viewportSize()!;
    for (const p of points) {
      expect(p.x, `${p.id} horizontal framing`).toBeGreaterThan(20);
      expect(p.x).toBeLessThan(viewport.width - 20);
      expect(p.y).toBeGreaterThan(100);
      expect(p.y).toBeLessThan(viewport.height - 140);
    }
    const solution = await page.evaluate(() => window.__huilang.solution());
    expect(solution.operations).toBe([1, 2, 4][chapter - 1]);
    let actions = solution.actions;
    // Group consecutive walks into a single click to verify BFS path following.
    actions = actions.filter((action, i) => action.kind !== 'walk' || actions[i + 1]?.kind !== 'walk');
    for (const action of actions) {
      await ready(page);
      if (action.kind === 'walk') {
        await clickTile(page, action.to, touch);
        if (action.to !== 'goal') {
          await expect.poll(() => page.evaluate(() => window.__huilang.snapshot().node)).toBe(action.to);
          await ready(page);
        }
      } else {
        const button = page.locator(`[data-mechanism="${action.id}"]`);
        if (chapter === 1) {
          const p = await page.evaluate(id => window.__huilang.mechanism(id), action.id);
          if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
        } else if (chapter === 2 && action.state === 1 && !touch) {
          const p = await page.evaluate(id => window.__huilang.mechanism(id), action.id);
          await page.mouse.move(p.x, p.y);
          await page.mouse.down();
          await page.mouse.move(p.x + 48, p.y, { steps: 6 });
          await page.mouse.up();
        } else await button.click();
        await expect.poll(() => page.evaluate(id => window.__huilang.snapshot().states[id], action.id)).toBe(action.state);
        await ready(page);
        await page.screenshot({ path: `artifacts/${testInfo.project.name}-level-${chapter}-${action.id}-${action.state}.png` });
      }
    }
  }
  await expect(page.locator('.completion h1')).toContainText('终相逢');
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-complete.png` });
  expect(errors).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: '选择章节' }).click();
  await expect(page.locator('[data-level="2"]')).toBeEnabled();
  await page.getByRole('button', { name: '静音', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '开启声音' })).toBeVisible();
});

test('场景渡台把手：轻微抖动点击与直接拖动', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('huilang:progress:v1', '{"unlocked":3,"completed":false}'));
  await page.goto('./');
  await page.getByRole('button', { name: '继续旅程' }).click();
  await clickTile(page, 'ferry', false);
  await ready(page);
  let p = await page.evaluate(() => window.__huilang.mechanism('tide'));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 2, p.y + 1);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__huilang.snapshot().states.tide)).toBe(1);
  await ready(page);
  p = await page.evaluate(() => window.__huilang.mechanism('tide'));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 170, p.y, { steps: 10 });
  await expect(page.locator('[data-mechanism="spire"]')).toBeDisabled();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__huilang.snapshot().states.tide)).toBe(0);
  await ready(page);
  await expect(page.getByRole('button', { name: '重置本关' })).toBeEnabled();
  expect(await page.evaluate(() => window.__huilang.snapshot().node)).toBe('ferry');
});

test('滑杆连续预览、吸附与重置；转轮锁定', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('huilang:progress:v1', '{"unlocked":3,"completed":false}'));
  await page.goto('./');
  await page.getByRole('button', { name: '继续旅程' }).click();
  await clickTile(page, 'ferry', false);
  await ready(page);
  await expect.poll(() => page.evaluate(() => window.__huilang.snapshot().node)).toBe('ferry');
  const range = page.getByRole('slider', { name: '拖动双生渡台' });
  const box = (await range.boundingBox())!;
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 8 });
  await expect(page.locator('[data-mechanism="spire"]')).toBeDisabled();
  await page.mouse.up();
  await ready(page);
  await expect.poll(() => page.evaluate(() => window.__huilang.snapshot().states.tide)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__huilang.snapshot().node)).toBe('ferry');
  await page.getByRole('button', { name: '重置本关' }).click();
  expect(await page.evaluate(() => window.__huilang.snapshot().states.tide)).toBe(0);
  expect(await page.evaluate(() => window.__huilang.snapshot().node)).toBe('start');
});
