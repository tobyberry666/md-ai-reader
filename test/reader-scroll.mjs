// Optional real-DOM check: npm install --no-save --package-lock=false playwright webpack react react-dom
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const webpack = require('webpack');
const { chromium } = require('playwright');
const output = fileURLToPath(new URL('../.cache/reader-scroll/', import.meta.url));
await mkdir(output, { recursive: true });
await writeFile(`${output}/entry.cjs`, `
const React = require('react');
const {createRoot} = require('react-dom/client');
const {Reader} = require('../../src/reader.js');
window.React = React; window.h = React.createElement; window.icon = () => null;
window.MarkdownText = ({text}) => React.createElement(React.Fragment, null,
  ...text.split('\\n').filter(Boolean).map((line, i) => {
    const heading = /^(#{1,6}) (.*)$/.exec(line);
    return React.createElement(heading ? 'h' + heading[1].length : 'p', {key:i}, heading ? heading[2] : line);
  }));
window.saved = [];
const text = '# 测试讲义\\n' + Array.from({length:32}, (_,i) =>
  '## 第' + (i+1) + '节\\n' + (i===31 ? '最后一节很短。' : '正文用于验证滚动时目录的位置。'.repeat(32))).join('\\n');
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(Reader, {document:{id:'fixture',text,scrollTop:0}, onQuote:()=>{}, onPosition:top=>saved.push(top)}));
window.unmountReader = () => root.unmount();
`);
await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: 'development', devtool: false, entry: `${output}/entry.cjs`,
    output: { path: output, filename: 'reader.cjs' },
    resolve: { alias: { 'react$': require.resolve('react'), 'react-dom/client$': require.resolve('react-dom/client') } },
  });
  compiler.run((error, stats) => compiler.close(() => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div class="mdr-app" style="height:620px;width:960px"><div id="root" style="height:100%"></div></div>');
  await page.addStyleTag({ content: await readFile(new URL('../src/styles.css', import.meta.url), 'utf8') });
  await page.addStyleTag({ content: '.mdr-reader{height:100%}' });
  await page.addScriptTag({ path: `${output}/reader.cjs` });
  await page.getByRole('navigation', { name: '文档目录' }).getByRole('button', { name: '第32节', exact: true }).waitFor();
  const active = page.locator('.mdr-toc button[aria-current="location"]');
  const scrollTo = async name => {
    await page.locator('.mdr-page-scroll').evaluate((element, title) => {
      const heading = [...element.querySelectorAll('h1,h2')].find(item => item.textContent === title);
      element.scrollTop += heading.getBoundingClientRect().top - element.getBoundingClientRect().top - 24;
    }, name);
    await active.filter({ hasText: new RegExp(`^${name}$`) }).waitFor({ timeout: 2000 });
  };
  const assertRevealed = async () => {
    const visible = await active.evaluate(button => {
      const nav = button.closest('nav');
      const item = button.getBoundingClientRect(), frame = nav.getBoundingClientRect();
      return { top: item.top, bottom: item.bottom, frameTop: frame.top, frameBottom: frame.bottom, scrollTop: nav.scrollTop };
    });
    assert.ok(visible.top >= visible.frameTop - 1 && visible.bottom <= visible.frameBottom + 1, `active entry must be revealed within its own TOC: ${JSON.stringify(visible)}`);
  };
  assert.equal(await active.count(), 0, 'idle initial reader has no indication');
  const normalWeight = await page.getByRole('button', { name: '第1节', exact: true }).evaluate(element => getComputedStyle(element).fontWeight);
  await scrollTo('第20节');
  assert.equal(await active.innerText({ timeout: 1500 }), '第20节');
  assert.equal(await active.evaluate(element => getComputedStyle(element).fontWeight), '700');
  await assertRevealed();
  const downTop = await page.locator('.mdr-toc').evaluate(element => element.scrollTop);
  assert.ok(downTop > 0);
  const bodyTop = await page.locator('.mdr-page-scroll').evaluate(element => element.scrollTop);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.mdr-page-scroll').evaluate(element => element.scrollTop), bodyTop, 'TOC following must not move the reading viewport');
  await page.locator('.mdr-toc').evaluate(element => { element.scrollTop = 0; });
  await page.locator('.mdr-page-scroll').evaluate(element => { element.scrollTop += 8; });
  await page.waitForTimeout(50);
  assert.equal(await active.innerText(), '第20节');
  await assertRevealed();

  await scrollTo('第1节');
  assert.equal(await active.innerText(), '第1节');
  await assertRevealed();
  const upTop = await page.locator('.mdr-toc').evaluate(element => element.scrollTop);
  assert.ok(upTop < downTop, `TOC should follow upward: ${JSON.stringify({ downTop, upTop })}`);
  await page.waitForTimeout(600);
  await page.locator('.mdr-page-scroll').evaluate(element => { element.scrollTop += 8; });
  await page.waitForTimeout(600);
  assert.equal(await active.count(), 1, 'another body scroll must reset the idle delay');
  await active.waitFor({ state: 'hidden', timeout: 1500 });
  assert.equal(await active.count(), 0, 'clear indication one second after the last body scroll');
  assert.equal(await page.getByRole('button', { name: '第1节', exact: true }).evaluate(element => getComputedStyle(element).fontWeight), normalWeight, 'restore the original text style when idle');

  await page.locator('.mdr-page-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await active.filter({ hasText: /^第32节$/ }).waitFor();
  assert.equal(await active.innerText(), '第32节', 'a short last section must become active at the document bottom');
  await assertRevealed();
  await active.waitFor({ state: 'hidden', timeout: 1500 });
  await page.getByRole('navigation', { name: '文档目录' }).getByRole('button', { name: '第12节', exact: true }).click();
  await active.filter({ hasText: /^第12节$/ }).waitFor();
  assert.equal(await active.innerText(), '第12节');
  await page.getByRole('button', { name: '切换目录', exact: true }).click();
  await page.locator('.mdr-page-scroll').evaluate(element => {
    const heading = [...element.querySelectorAll('h2')].find(item => item.textContent === '第16节');
    element.scrollTop += heading.getBoundingClientRect().top - element.getBoundingClientRect().top - 24;
  });
  await page.waitForTimeout(40);
  await page.getByRole('button', { name: '切换目录', exact: true }).click();
  await active.filter({ hasText: /^第16节$/ }).waitFor();
  assert.equal(await active.innerText(), '第16节');
  await assertRevealed();
  await page.screenshot({ path: `${output}/following.png` });
  await page.evaluate(() => unmountReader());
  await page.waitForTimeout(1100);
  assert.ok(await page.evaluate(() => saved.length > 0));
  assert.deepEqual(errors, []);
  console.log('PASS: Reader scroll follows forward/backward, reveals TOC, handles short final section, resets 1s idle indication, navigates, toggles and unmounts.');
} finally { await browser.close(); }
