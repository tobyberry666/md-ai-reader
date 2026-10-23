// Exercises the installed DSH renderer with its real claude-style composition.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP(process.env.DSH_CDP || 'http://127.0.0.1:9237');
try {
  const page = browser.contexts().flatMap(context => context.pages()).find(p => p.url().startsWith('dsh-app://app/'));
  assert.ok(await page.locator('body[data-dsh-claude-style]').count(), 'claude-style must be enabled');
  assert.equal(await page.locator('.mdr-native .dsh-side-chat-trigger').isVisible(), false, 'MD reader must not expose the unrelated side-chat trigger');
  const geometry = await page.locator('.mdr-native [data-conversation-scroll]').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
  assert.ok(geometry.scrollWidth <= geometry.width + 2, `native composer overflows: ${JSON.stringify(geometry)}`);
  const chat = await page.locator('.mdr-chat').boundingBox();
  for (const element of await page.locator('.mdr-native button[aria-label="发送消息"],.mdr-native button[aria-label^="选择模型"]').all()) {
    if (!await element.isVisible()) continue;
    const box = await element.boundingBox();
    assert.ok(box.x >= chat.x - 1 && box.x + box.width <= chat.x + chat.width + 1, 'native controls must stay in the chat column');
    assert.ok(box.y >= chat.y && box.y + box.height <= chat.y + chat.height + 1, 'native controls must remain above the viewport bottom');
  }
  const label = page.locator('.mdr-native [data-dsh-claude-model-host] [data-dsh-claude-part~=trigger-label]');
  assert.ok(await label.evaluate(element => getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 30), 'model label must be readable');
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false });
    const narrow = await page.locator('.mdr-split').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
    assert.ok(narrow.scrollWidth <= narrow.width + 2, 'narrow layout must not overflow horizontally');
  } finally { await cdp.send('Emulation.clearDeviceMetricsOverride'); await cdp.detach(); }
  console.log('PASS: claude-style native controls stay within the embedded conversation.');
} finally { await browser.close(); }
