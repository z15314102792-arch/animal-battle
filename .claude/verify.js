/**
 * 动物大战 · 验收脚本
 * 用法: node verify.js
 * 输出: verify-results.json
 */
const fs = require('fs');
const vm = require('vm');

const PROJECT = { name: '动物大战', version: null, entryFile: 'index.html' };
const results = { project: PROJECT.name, version: PROJECT.version, timestamp: new Date().toISOString(), checks: [], summary: { total: 0, passed: 0, failed: 0 } };
function addCheck(name, pass, data = {}) { results.checks.push({ name, pass, data }); results.summary.total++; if (pass) results.summary.passed++; else results.summary.failed++; }
function fail(msg) { console.error('[verify] ' + msg); fs.writeFileSync('verify-results.json', JSON.stringify(results, null, 2)); process.exit(1); }

// ====== 1. 入口文件检查 ======
console.log('[verify] 读取 ' + PROJECT.entryFile + '...');
let html;
try { html = fs.readFileSync(PROJECT.entryFile, 'utf-8'); } catch (e) { fail('无法读取: ' + e.message); }
const titleMatch = html.match(/<title>[^<]*(\d+\.\d+)[^<]*<\/title>/);
PROJECT.version = titleMatch ? 'v' + titleMatch[1] : 'unknown';
results.version = PROJECT.version;
addCheck('入口文件存在', true, { size_bytes: html.length, lines: html.split('\n').length });

// ====== 2. JS 语法检查 ======
console.log('[verify] 语法检查...');
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match, allScripts = '';
while ((match = scriptRegex.exec(html)) !== null) { allScripts += match[1].trim() + '\n'; }
allScripts = allScripts.trim();
if (!allScripts) fail('未找到 <script> 标签');
try { new Function(allScripts); addCheck('JS 语法正确', true, { code_size: allScripts.length }); }
catch (e) { addCheck('JS 语法正确', false, { line: e.lineNumber, message: e.message }); fail('JS 语法错误'); }

// ====== 3. 游戏核心结构检查 ======
console.log('[verify] 检查动物大战核心结构...');
const codemarks = [];
if (allScripts.includes('class Animal') || allScripts.includes('animals')) codemarks.push('动物类/数组');
if (allScripts.includes('class Game') || allScripts.includes('function Game')) codemarks.push('Game类');
if (allScripts.includes('map') || allScripts.includes('Map') || allScripts.includes('board')) codemarks.push('地图系统');
if (allScripts.includes('attack') || allScripts.includes('damage') || allScripts.includes('战斗')) codemarks.push('战斗系统');
if (allScripts.includes('draw') || allScripts.includes('render') || allScripts.includes('canvas')) codemarks.push('渲染');
if (allScripts.includes('click') || allScripts.includes('tap')) codemarks.push('点击交互');
addCheck('游戏核心结构', codemarks.length >= 4, { found: codemarks });

// ====== 4. 动物种类检查 ======
console.log('[verify] 统计动物种类...');
const animalNames = new Set();
// 匹配动物定义模式: name: "xxx" / 'name': 'xxx' / "xxx": { ... hp/attack
const animalDefs = allScripts.match(/(?:name|id|type)\s*:\s*['"](\w+)['"]/gi) || [];
for (const def of animalDefs) {
  const nm = def.match(/['"](\w+)['"]\s*$/);
  if (nm && nm[1].length > 1) animalNames.add(nm[1].toLowerCase());
}
// 检查动物数量关键词
const animalKeywords = (allScripts.match(/\b(animals?|creatures?|beasts?|monsters?|动物)\b/gi) || []).length;
addCheck('动物种类数量', animalNames.size >= 4 || animalKeywords >= 3, { count: animalNames.size, names: [...animalNames].slice(0, 20), animal_keywords: animalKeywords });

// ====== 5. 地图系统检查 ======
const hasMapCode = allScripts.includes('map') || allScripts.includes('Map') || allScripts.includes('level') || allScripts.includes('Level');
addCheck('地图系统', hasMapCode, { has_map_ref: allScripts.includes('map') });

// ====== 写入结果 ======
fs.writeFileSync('verify-results.json', JSON.stringify(results, null, 2));
console.log('[verify] ' + results.summary.passed + '/' + results.summary.total + ' 通过');
process.exit(results.summary.failed > 0 ? 1 : 0);
