# probes.md —— 页面内逐帧探针范式

> 雷鹰战机全部版本测试用的骨架。适用任何 rAF 驱动页面；三个坑的完整根源见全局踩坑日志 #53/#55/#58。
> 核心：**不依赖真实时间**——`game.update(1/60)` 手动泵帧，确定性、可复算、不受 IAB 面板 rAF 冻结影响。

## 骨架（每轮一个自包含单元）

```js
// bootstrap（每次 js 调用都要跑）
const browserPluginRoot = process.env.ZCODE_PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT;
const { join } = await import('node:path');
const { pathToFileURL } = await import('node:url');
const { setupBrowserRuntime } = await import(pathToFileURL(join(browserPluginRoot, 'scripts', 'browser-client.mjs')).href);
await setupBrowserRuntime({ globals: globalThis });

const browser = await agent.browsers.getForUrl('http://localhost:8766/');
await (await browser.capabilities.get('visibility')).set(true);   // 面板可见：rAF 才可能工作
// 表格页恢复：list → 匹配 URL → tabs.get(id)；无则 tabs.new() + goto
// 缓存：python http.server 记忆缓存顽固 → 静态资源带 ?v= 戳，或换端口

// 泵帧助手
const step = (frames) => tab.playwright.evaluate(
  `(() => { for (let i = 0; i < ${frames}; i++) { game.update(1 / 60); } game.render(); return true; })()`,
);
```

## 铁律
1. **evaluate 一律写表达式/IIFE**：`"(() => { ... })()"`——函数字符串会被静默丢弃（#55）。
2. **多个 evaluate 之间要读回状态自证**（尤其破坏性操作后），不要假设上一步成功。
3. **造场景前先清场/冻结**：`enemies=[]、bullets=[]、spawnQueue=[]、waveTimer=9999、invul=9999`；
   否则残留 AI 会污染读数（本例实测"盾×2 变盾×3"就是残留波次击杀掉盾被捡）。
4. **触发测试路径选共用入口**：不可伪造的 API（如 document.hidden #58）不硬伪造，改用同一被调函数的入口（✕ 按钮 = doPause = visibilitychange 处理）。
5. 数值断言优先于截图；截图通道偶发 `capture failed for guest`，try/catch 包裹不影响探针，失败重开标签页恢复。

## 本游戏常用探针手法
- 重置 + 金身：`game.start(); game.ui.showScreen('hud-only'); game.player.invul = 9999;`
- 关卡/波次：`game.stage = 7; game.waveInStage = 2; game.nextWave();`（注意 waveInStage>2 会被轮进下一关）
- 事件波分支：临时换 `Math.random` 固定种子（用后会验恢复）。
- 存档隔离断言：读 `localStorage` 键值（玩家档案见 js/profile.js：`th_best_名字` 等）。
- 玩家档案迁移构造：清 `th_players/th_current` 后注入旧匿名键（`th_best/th_ach/th_stats`）再刷新触发 ensureDefault。
  注意档案键名带 `encodeURIComponent(名字)`（如 `th_best_%E7%8E%A9%E5%AE%B61`），直读"玩家1"会取空。
- 关页杀服验证：**不要用 `bu.close_tab()`**（CDP 销毁 target 不触发 pagehide，beacon 不发出，无法验证）；
  用 `bu.js("window.location.href='about:blank'")` 走真实 pagehide → sendBeacon 路径，再 `netstat` 断言端口释放。
- 刷新竞态复现：pagehide 的 sendBeacon 可能晚于 reload 后新页面的 /ping 到达（实测晚 13~18ms），
  竞态下服务器 4s 后被误杀；页面定时保活（setInterval /ping，间隔 < server GRACE 4s）可消除——验证
  刷新保活应 reload 后等 >4s 再 curl /ping。
