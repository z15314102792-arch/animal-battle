/**
 * 动物大战 2.0 冒烟测试
 *
 * 覆盖：
 * 1. 页面加载和核心元素
 * 2. 数据驱动结构
 * 3. 开始 3v3 战斗
 * 4. 战术指令会消耗次数
 * 5. 生态导演和复盘结构
 * 6. 战斗循环无 JS 报错
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const GAME_URL = 'file:///' + path.resolve(__dirname, '..', 'v2', 'index.html').replace(/\\/g, '/');
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const BROWSER_PATH = BROWSER_PATHS.find(p => fs.existsSync(p));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  通过 ${name}`);
    passed++;
  } else {
    console.log(`  失败 ${name}${detail ? ' - ' + detail : ''}`);
    failed++;
  }
}

(async () => {
  console.log('动物大战 2.0 冒烟测试');
  console.log(`页面: ${GAME_URL}`);
  if (!BROWSER_PATH) {
    console.log('测试脚本异常: 未找到 Chrome 或 Edge 浏览器');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: BROWSER_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(300);

    check('Canvas 存在', await page.$('#battlefield') !== null);
    check('开始按钮存在', await page.$('#startBattle') !== null);
    check('动物网格存在', await page.$('#animalGrid') !== null);
    check('蓝队面板存在', await page.$('#blueTeam') !== null);
    check('红队面板存在', await page.$('#redTeam') !== null);
    check('底部跳转存在', await page.$$eval('.bottom-nav button', els => els.length) === 5);
    check('战术指令存在', await page.$$eval('#screenBattle .orders button', els => els.length) === 3);

    const data = await page.evaluate(() => ({
      animalCount: Object.keys(window.__v2Game.ANIMALS).length,
      instinctCount: Object.keys(window.__v2Game.INSTINCTS).length,
      behaviorTagCount: Object.keys(window.__v2Game.BEHAVIOR_TAGS).length,
      animalsWithTags: Object.values(window.__v2Game.ANIMALS).filter(a => a.behaviorTags && a.behaviorTags.length >= 2).length,
      directorEventCount: window.__v2Game.DIRECTOR_EVENTS.length,
      zoneCount: window.__v2Game.MAP.zones.length,
      unitCount: window.__v2Game.state.units.length
    }));
    check('6 个 MVP 动物已注册', data.animalCount === 6, `实际 ${data.animalCount}`);
    check('4 种本能已注册', data.instinctCount === 4, `实际 ${data.instinctCount}`);
    check('行为标签库已注册', data.behaviorTagCount >= 8, `实际 ${data.behaviorTagCount}`);
    check('每个 MVP 动物都有行为标签', data.animalsWithTags === 6, `实际 ${data.animalsWithTags}`);
    check('生态导演事件已注册', data.directorEventCount >= 3, `实际 ${data.directorEventCount}`);
    check('河谷空间层已注册', data.zoneCount >= 5, `实际 ${data.zoneCount}`);
    check('部署阶段 6 个单位', data.unitCount === 6, `实际 ${data.unitCount}`);

    await page.click('#screenHome [data-start="1"]');
    await sleep(1200);
    const running = await page.evaluate(() => ({
      phase: window.__v2Game.state.phase,
      screen: window.__v2Game.state.screen,
      units: window.__v2Game.state.units.length,
      aliveBlue: window.__v2Game.state.units.filter(u => u.side === 'blue' && !u.dead).length,
      aliveRed: window.__v2Game.state.units.filter(u => u.side === 'red' && !u.dead).length,
      time: window.__v2Game.state.time
    }));
    check('进入战斗阶段', running.phase === 'battle' || running.phase === 'ended', `实际 ${running.phase}`);
    check('开始后切到战斗画面', running.screen === 'battle' || running.screen === 'review', `实际 ${running.screen}`);
    check('3v3 单位数量正确', running.units === 6, `实际 ${running.units}`);
    check('双方初始可战斗', running.aliveBlue > 0 && running.aliveRed > 0);
    check('战斗时间推进', running.time > 0.5, `实际 ${running.time}`);

    await page.click('#orderFocus');
    await sleep(200);
    await page.click('#orderGuard');
    await sleep(2600);
    const afterOrders = await page.evaluate(() => ({
      ordersLeft: window.__v2Game.state.ordersLeft,
      hasLog: window.__v2Game.state.log.length > 0,
      directorEvents: window.__v2Game.state.director.events.length,
      directorStatus: document.getElementById('directorStatus').textContent,
      ordersUsed: window.__v2Game.state.recapStats.orders,
      phase: window.__v2Game.state.phase,
      time: window.__v2Game.state.time
    }));
    check('战术指令消耗次数', afterOrders.ordersLeft === 0, `实际 ${afterOrders.ordersLeft}`);
    check('战术指令进入复盘统计', afterOrders.ordersUsed === 2, `实际 ${afterOrders.ordersUsed}`);
    check('生态导演已触发事件', afterOrders.directorEvents >= 1, `实际 ${afterOrders.directorEvents}`);
    check('河谷状态栏显示生态事件', afterOrders.directorStatus.includes('河谷状态：') && !afterOrders.directorStatus.includes('平静 · 紧张度 0%'));
    check('事件日志产生内容', afterOrders.hasLog);
    check('战斗循环仍正常', ['battle', 'ended'].includes(afterOrders.phase));

    await page.evaluate(() => window.__v2Game.forceEndForTest());
    await sleep(250);
    const review = await page.evaluate(() => ({
      phase: window.__v2Game.state.phase,
      screen: window.__v2Game.state.screen,
      recapCount: document.querySelectorAll('#recap p').length,
      recapText: document.getElementById('recap').textContent
    }));
    check('结束后切到复盘画面', review.phase === 'ended' && review.screen === 'review', `实际 ${review.phase}/${review.screen}`);
    check('复盘生成关键因果', review.recapCount >= 2 && review.recapText.includes('生态导演'), `实际 ${review.recapText}`);

    check('全程无 JS 报错', errors.length === 0, errors.slice(0, 3).join('; '));
  } catch (err) {
    console.log(`测试脚本异常: ${err.message}`);
    failed++;
  } finally {
    await browser.close();
  }

  console.log(`结果: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
  process.exit(failed > 0 ? 1 : 0);
})();
