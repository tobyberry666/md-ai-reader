import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP(process.env.DSH_CDP || 'http://127.0.0.1:9237');
const page = browser.contexts().flatMap(context => context.pages()).find(p => p.url().startsWith('dsh-app://app/'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 2000)); });
page.on('response', response => { if (response.status() >= 400) console.log('HTTP', response.status(), response.url()); });
const action = process.argv[2] || 'state';
try {
  if (action === 'reload') { await page.reload(); await page.getByRole('button', { name: 'MD 阅读', exact: true }).click(); }
  if (action === 'import') {
    await page.getByLabel('选择 Markdown 文件', { exact: true }).setInputFiles(process.argv[3] || new URL('fixtures/physical-layer.md', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
    await page.locator('.mdr-prose h1').waitFor({ timeout: 15000 });
  }
  if (action === 'quote') {
    await page.locator('.mdr-prose p').filter({ hasText: '物理层关心' }).evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await page.getByRole('button', { name: '提问', exact: true }).click();
  }
  if (action === 'ask') {
    const input = page.locator('.mdr-native [contenteditable=true]');
    await input.press('End');
    await input.pressSequentially(process.argv[3] || '根据文档全文，设备 A 的接口速率和末尾实验校验码分别是什么？请简短回答并指出来源章节。');
    await input.press('Enter');
    await page.locator('.mdr-native').getByText('ORCHID-7319-K8M', { exact: false }).last().waitFor({ timeout: 60000 });
  }
  if (action === 'state' || action === 'reload') await page.locator('.mdr-app').waitFor({ timeout: 15000 });
  console.log((await page.locator('.mdr-app').innerText()).slice(-10000));
  console.log(JSON.stringify({ errors, inputCount: await page.locator('.mdr-native [contenteditable=true]').count(), scopedSession: await page.locator('[data-md-reader-session]').getAttribute('data-md-reader-session').catch(() => null) }));
  await mkdir(new URL('../.cache/screenshots/', import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL(`../.cache/screenshots/${action}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1') });
} finally { await browser.close(); }
