import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('../../vc-expo-intelligence/node_modules/playwright');
const browser = await chromium.connectOverCDP(process.env.DSH_CDP || 'http://127.0.0.1:9237');
const results = [];
try {
  const page = browser.contexts().flatMap(context => context.pages()).find(p => p.url().startsWith('dsh-app://app/'));
  const ownErrors = [];
  page.on('pageerror', error => ownErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /slot entry crashed|slot factory occurrence crashed|dsh-md-reader/.test(message.text())) ownErrors.push(message.text()); });
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  const fixture = name => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));
  const waitReady = async () => {
    await page.locator('.mdr-native [contenteditable=true]').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('.mdr-error').count(), 0, 'reader must be error-free');
  };
  const importFile = async name => {
    // Preserve native file identity: Playwright's remote FilePayload uploads lose
    // Electron's local path, whereas the real file-input CDP method does not.
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[aria-label="选择 Markdown 文件"]' });
    await cdp.send('DOM.setFileInputFiles', { nodeId, files: [fixture(name)] });
    await cdp.detach();
    await page.locator('.mdr-tab[data-active=true]').getByRole('tab', { name }).waitFor();
    await page.locator('.mdr-import:not(:disabled)').first().waitFor();
    await waitReady();
  };
  await page.reload();
  await page.getByRole('button', { name: 'MD 阅读', exact: true }).click();
  await page.locator('.mdr-import:not(:disabled)').first().waitFor();
  await importFile('physical-layer.md');
  const firstSession = await page.locator('[data-md-reader-session]').getAttribute('data-md-reader-session');
  assert.equal(await page.locator('body[data-dsh-claude-style]').count(), 1);
  assert.equal(await page.locator('.mdr-prose table').count(), 2);
  assert.ok(await page.locator('.mdr-prose .katex').count());
  assert.ok(await page.locator('.mdr-prose pre code').count());
  results.push('native claude-style composition, tables, highlighted code and math');

  const model = page.locator('.mdr-native [data-dsh-claude-model-host] button');
  assert.ok((await model.getAttribute('aria-label')).includes('deepseek-v4.1-flash-1017'));
  assert.equal(await model.isVisible(), true);
  assert.equal(await page.locator('.mdr-native .dsh-claude-model-btn').isVisible(), false);
  await model.click();
  await page.getByRole('menu').waitFor();
  assert.ok((await page.getByRole('menu').innerText()).includes('deepseek-v4.1-flash-1017'));
  await page.keyboard.press('Escape');
  results.push('correct independent-session model control and native menu under claude-style');

  await page.getByRole('button', { name: '搜索文档', exact: true }).click();
  await page.getByRole('textbox', { name: '查找文本' }).fill('设备');
  await page.waitForFunction(() => Number(document.querySelector('.mdr-search [role=status]')?.textContent?.split('/')[1]) >= 3);
  const before = await page.locator('.mdr-search [role=status]').innerText();
  await page.getByRole('button', { name: '下一处匹配' }).click();
  assert.notEqual(await page.locator('.mdr-search [role=status]').innerText(), before);
  await page.getByRole('button', { name: '关闭搜索' }).click();
  results.push('full-text search navigation');

  await page.getByRole('navigation', { name: '文档目录' }).getByRole('button', { name: '末尾校验', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.mdr-page-scroll').scrollTop > 100);
  const top = await page.locator('.mdr-page-scroll').evaluate(element => element.scrollTop);
  await page.waitForTimeout(550);
  await page.reload();
  await page.getByRole('button', { name: 'MD 阅读', exact: true }).click();
  await waitReady();
  await page.waitForFunction(expected => Math.abs(document.querySelector('.mdr-page-scroll').scrollTop - expected) < 3, top);
  assert.equal(await page.locator('[data-md-reader-session]').getAttribute('data-md-reader-session'), firstSession);
  results.push('scroll and native session restored after full renderer reload');

  await page.locator('.mdr-prose pre code').scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  await page.locator('.mdr-prose pre code').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.getByRole('button', { name: '提问', exact: true }).click();
  const input = page.locator('.mdr-native [contenteditable=true]');
  assert.ok((await input.innerText()).includes('import math'));
  await input.press('Control+A'); await input.press('Backspace');
  await input.pressSequentially('草稿保留');
  results.push('code selection inserts removable native quote');

  const secondText = await readFile(fixture('independent.md'), 'utf8');
  await page.locator('.mdr-app').evaluate((element, text) => {
    const transfer = new DataTransfer(); transfer.items.add(new File([text], 'independent.md', { type: 'text/markdown' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, secondText);
  await page.locator('.mdr-tab[data-active=true]').getByRole('tab', { name: 'independent.md' }).waitFor();
  await waitReady();
  const secondSession = await page.locator('[data-md-reader-session]').getAttribute('data-md-reader-session');
  assert.notEqual(secondSession, firstSession);
  assert.ok(!(await page.locator('.mdr-native').innerText()).includes('ORCHID-7319-K8M'));
  await page.getByRole('tab', { name: 'physical-layer.md', exact: true }).click();
  await waitReady();
  assert.ok((await page.locator('.mdr-native [contenteditable=true]').innerText()).includes('草稿保留'));
  await input.press('Control+A'); await input.press('Backspace');
  results.push('drag/drop, independent sessions and document-specific draft restoration');

  await importFile('with-image.md');
  await page.waitForFunction(() => [...document.querySelectorAll('.mdr-prose img')].some(image => image.naturalWidth === 480));
  assert.equal(await page.evaluate(() => Boolean(window.__mdrXssExecuted)), false);
  assert.equal(await page.locator('.mdr-prose script').count(), 0);
  assert.equal(await page.locator('.mdr-prose a[href^="javascript:"]').count(), 0);
  results.push('relative local image via native file route and inert malicious HTML/links');

  await importFile('physical-layer.md');
  const separator = page.getByRole('separator', { name: '调整阅读区和对话区宽度' });
  const splitBefore = await separator.getAttribute('aria-valuenow');
  await separator.press('ArrowLeft');
  assert.notEqual(await separator.getAttribute('aria-valuenow'), splitBefore);
  const geometry = await page.locator('.mdr-native [data-conversation-scroll]').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
  assert.ok(geometry.scrollWidth <= geometry.width + 2, `native composer overflows: ${JSON.stringify(geometry)}`);
  const light = await page.locator('body').evaluate(body => body.hasAttribute('data-ds-dark-theme'));
  if (!light) await page.locator('body').evaluate(body => body.setAttribute('data-ds-dark-theme', ''));
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/dark.png', import.meta.url)) });
  if (!light) await page.locator('body').evaluate(body => body.removeAttribute('data-ds-dark-theme'));
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/desktop.png', import.meta.url)) });
  results.push('keyboard divider and constrained native controls, light/dark rendering');

  assert.deepEqual(ownErrors, []);
  console.log(JSON.stringify({ passed: results.length, results, firstSession, secondSession, pluginErrors: ownErrors }, null, 2));
} finally { await browser.close(); }
