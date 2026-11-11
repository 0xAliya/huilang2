import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:5174/huilang2/',
    channel: 'chrome',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl'] },
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  workers: 1,
});
