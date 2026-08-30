/**
 * 动物大战 2.0 视觉冒烟测试
 *
 * 输出两张截图，并检查 Canvas 不是空白。
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const GAME_URL = 'file:///' + path.resolve(__dirname, '..', 'v2', 'index.html').replace(/\\/g, '/');
const OUTPUT_DIR = 'C:\\Users\\Administrator\\Documents\\Codex\\2026-08-30\\referenced-chatgpt-conversation-this-is-an\\outputs';
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const BROWSER_PATH = BROWSER_PATHS.find(p => fs.existsSync(p));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(browser, viewport, name) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(GAME_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  await page.click('#screenHome [data-start="1"]');
  await sleep(1200);
  const stats = await page.evaluate(() => {
    const canvas = document.getElementById('battlefield');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonblank = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) nonblank++;
    }
    return {
      phase: window.__v2Game.state.phase,
      screen: window.__v2Game.state.screen,
      time: window.__v2Game.state.time,
      units: window.__v2Game.state.units.length,
      nonblankRatio: nonblank / (data.length / 4),
      viewportHeight: window.innerHeight,
      bodyScrollHeight: document.body.scrollHeight
    };
  });
  const screenshot = path.join(OUTPUT_DIR, `animal-battle-v2-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.close();
  return { name, screenshot, stats };
}

(async () => {
  if (!BROWSER_PATH) {
    console.log('未找到 Chrome 或 Edge 浏览器');
    process.exit(1);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: BROWSER_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const results = [];
    results.push(await capture(browser, { width: 1280, height: 900 }, 'desktop'));
    results.push(await capture(browser, { width: 320, height: 780, isMobile: true }, 'mobile-320'));
    results.push(await capture(browser, { width: 375, height: 812, isMobile: true }, 'mobile-375'));
    results.push(await capture(browser, { width: 414, height: 896, isMobile: true }, 'mobile-414'));
    results.push(await capture(browser, { width: 768, height: 1024, isMobile: true }, 'tablet-768'));
    for (const result of results) {
      console.log(`${result.name}: ${JSON.stringify(result.stats)} -> ${result.screenshot}`);
      if (result.stats.units !== 6 || result.stats.time <= 0.5 || result.stats.nonblankRatio < 0.9 || result.stats.bodyScrollHeight > result.stats.viewportHeight + 2) {
        process.exitCode = 1;
      }
    }
  } finally {
    await browser.close();
  }
})();
