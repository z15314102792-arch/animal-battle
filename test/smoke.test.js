/**
 * 动物大战 — 冒烟测试
 *
 * 做什么：
 *   1. 打开游戏页面
 *   2. 检查页面元素是否完整
 *   3. 选两只动物、开始对战
 *   4. 让游戏跑 6 秒
 *   5. 全程抓 JS 报错
 *
 * 运行：node test/smoke.test.js
 */

const puppeteer = require('puppeteer-core');
const path = require('path');

const GAME_URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const BATTLE_DURATION = 6000; // 对战跑多久（毫秒）

// 本机 Chrome 路径
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = ms => new Promise(r => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

(async () => {
  console.log('🧪 动物大战冒烟测试');
  console.log(`   页面: ${GAME_URL}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // ── 收集 JS 报错 ──
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // ══════════════════════════════════════
    // 阶段 1：加载页面
    // ══════════════════════════════════════
    console.log('📄 阶段 1：加载页面');
    await page.goto(GAME_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(500);

    check('页面加载成功', true);
    check('Canvas 存在', await page.$('#game') !== null);
    check('开始按钮存在', await page.$('#bf') !== null);
    check('重置按钮存在', await page.$('#bx') !== null);
    check('随机按钮存在', await page.$('#br') !== null);
    check('动物卡片网格存在', await page.$('#animalGrid') !== null);
    check('说明按钮存在', await page.$('#bg') !== null);
    check('地图选择器存在', await page.$('#msel') !== null);
    check('速度按钮存在', await page.$$eval('.speed-btn', els => els.length) >= 4);
    check('评论区存在', await page.$('#commentBar') !== null);
    check('Toast 存在', await page.$('#toast') !== null);
    check('引导页覆盖层存在', await page.$('#guideOverlay') !== null);

    check('加载后无 JS 报错', errors.length === 0,
      errors.length > 0 ? `发现 ${errors.length} 个错误: ${errors.slice(0, 3).join('; ')}` : '');

    // ══════════════════════════════════════
    // 阶段 2：添加动物（新卡片UI）
    // ══════════════════════════════════════
    console.log('');
    console.log('🎯 阶段 2：添加动物（卡片点击）');

    // 点击鸡卡片
    await page.click('.animal-card[data-key="chicken"]');
    await sleep(200);

    // 点击熊卡片
    await page.click('.animal-card[data-key="bear"]');
    await sleep(200);

    // 检查标签显示
    const tagCount = await page.$$eval('#tags .tag', els => els.length);
    check('标签显示正确（2只动物）', tagCount === 2, `实际: ${tagCount}`);

    // ══════════════════════════════════════
    // 阶段 3：开始对战
    // ══════════════════════════════════════
    console.log('');
    console.log('⚔️ 阶段 3：开始对战');

    const btnText = await page.$eval('#bf', el => el.textContent);
    check('按钮文字正确', btnText.includes('开始'), `实际: "${btnText}"`);

    // 点击开始
    await page.click('#bf');
    await sleep(500);

    // 检查按钮变成禁用状态（对战中）
    const btnDisabled = await page.$eval('#bf', el => el.disabled);
    check('开始后按钮禁用', btnDisabled, '按钮应该在对战中禁用');

    // ══════════════════════════════════════
    // 阶段 4：对战运行中
    // ══════════════════════════════════════
    console.log('');
    console.log(`⏱️ 阶段 4：对战运行 ${BATTLE_DURATION / 1000} 秒`);

    // 跑一半时间
    await sleep(BATTLE_DURATION / 2);

    // 检查游戏循环是否在跑
    const midErrors = errors.length;
    const hasAnimals = await page.evaluate(() => {
      return typeof animals !== 'undefined' && animals.length > 0;
    });
    check('游戏循环在运行（animals 数组非空）', hasAnimals);

    const stateAlive = await page.evaluate(() => gameState);
    check('游戏状态为 running', stateAlive === 'fighting', `实际: "${stateAlive}"`);

    // 跑完剩余时间
    await sleep(BATTLE_DURATION / 2);

    // ══════════════════════════════════════
    // 阶段 5：检查结果
    // ══════════════════════════════════════
    console.log('');
    console.log('🔍 阶段 5：检查结果');

    // 收集对战期间的新报错
    const battleErrors = errors.length - midErrors;
    check('对战期间无新 JS 报错', battleErrors === 0,
      battleErrors > 0 ? `新增 ${battleErrors} 个错误: ${errors.slice(midErrors).join('; ')}` : '');

    // 检查评论栏有更新（说明战斗事件在发生）
    const commentText = await page.$eval('#commentBar', el => el.textContent.trim());
    check('评论区有战斗事件', commentText.length > 10,
      `评论内容: "${commentText.slice(0, 80)}"`);

    // 检查游戏已结束或有动物存活
    const finalState = await page.evaluate(() => {
      return {
        state: gameState,
        animalCount: animals.filter(a => !a.dead).length,
        totalAnimals: animals.length,
        eggCount: eggs.length,
        winner: winner ? winner.displayName || winner.emoji : null
      };
    });
    console.log(`   最终状态: ${finalState.state}, 存活: ${finalState.animalCount}/${finalState.totalAnimals}, 蛋: ${finalState.eggCount}, 胜者: ${finalState.winner || '无'}`);

    check('对战正常结束或运行中', ['ended', 'fighting'].includes(finalState.state),
      `实际状态: "${finalState.state}"`);

    // ══════════════════════════════════════
    // 汇总
    // ══════════════════════════════════════
    console.log('');
    console.log('══════════════════════════════════');
    console.log(`  结果: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
    if (errors.length > 0) {
      console.log(`  ⚠️ 页面 JS 报错 (${errors.length} 个):`);
      errors.forEach((e, i) => console.log(`     ${i + 1}. ${e}`));
    }
    console.log('══════════════════════════════════');

  } catch (err) {
    console.log('');
    console.log(`💥 测试脚本崩溃: ${err.message}`);
    failed++;
  } finally {
    await browser.close();
  }

  // 退出码：有失败就非零
  process.exit(failed > 0 ? 1 : 0);
})();
