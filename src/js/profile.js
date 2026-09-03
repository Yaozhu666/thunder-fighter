/* profile.js —— 本地玩家档案（v12.0）：一个名字 = 一个玩家，无密码
 * 数据按玩家隔离：th_best_名字 / th_ach_名字 / th_stats_名字 / th_diff_名字
 * 设备级设置（静音/震动/语言类）仍是全局键。旧版匿名数据自动迁移成默认玩家。 */
'use strict';

const Players = (() => {
  const NAMES = 'th_players';      // 玩家名列表（最近使用在前）
  const CURRENT = 'th_current';    // 当前玩家
  const MAX = 6;                   // 最多存档玩家数

  function list() {
    try { return JSON.parse(localStorage.getItem(NAMES) || '[]'); } catch (e) { return []; }
  }
  function saveList(names) { try { localStorage.setItem(NAMES, JSON.stringify(names)); } catch (e) {} }
  function current() {
    try { return localStorage.getItem(CURRENT) || ''; } catch (e) { return ''; }
  }
  function setCurrent(n) { try { localStorage.setItem(CURRENT, n); } catch (e) {} }
  function key(prefix, name) { return prefix + '_' + encodeURIComponent(name); }

  /* 首次启动：把 v11 及以前的匿名数据迁移为默认玩家「玩家1」 */
  function ensureDefault() {
    const names = list();
    let cur = current();
    if (names.length === 0) {
      saveList(['玩家1']);
      for (const p of ['th_best', 'th_ach', 'th_stats']) {
        const v = localStorage.getItem(p);
        if (v !== null) {
          try {
            localStorage.setItem(key(p, '玩家1'), v);
            localStorage.removeItem(p);
          } catch (e) {}
        }
      }
      setCurrent('玩家1');
      return '玩家1';
    }
    if (!names.includes(cur)) { cur = names[0]; setCurrent(cur); }
    return cur;
  }

  /* 新增/切换玩家：清洗、限长、去重；返回规范化后的名字 */
  function switchTo(raw) {
    const name = String(raw || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
    if (!name) return null;
    const names = list();
    if (!names.includes(name)) {
      names.unshift(name);
      if (names.length > MAX) names.length = MAX;
      saveList(names);
    }
    setCurrent(name);
    return name;
  }

  function get(name, prefix, def) {
    try {
      const v = localStorage.getItem(key(prefix, name));
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  }
  function set(name, prefix, val) {
    try { localStorage.setItem(key(prefix, name), JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- 战机舰队档案（v13.0）：th_fleet_名字 ---------- */
  function defaultFleet() {
    return {
      owned: { falcon: { lv: 1 } },     // 已拥有战机 { id: {lv} }
      equipped: 'falcon',               // 当前装备战机
      cards: {},                        // 各战机卡数量 { id: n }
      tickets: 0,                       // 战机券
      pity: 0,                          // 保底计数（10 抽必高级）
      progress: 0,                      // 连续通关进度（已连续打通的关卡数）
      resume: 1,                        // 续关点（最近一次打上去输掉的关卡）
      stats: {                          // 数值类成就累计
        score: 0, bestScore: 0, combo: 0, elites: 0, bosses: 0, stage: 0,
      },
    };
  }
  function fleetGet(name) {
    const f = get(name, 'th_fleet', null);
    if (!f) return null;
    const d = defaultFleet();
    // 兼容填充缺省字段
    f.owned = f.owned || d.owned;
    f.equipped = f.equipped || 'falcon';
    if (!f.owned.falcon) f.owned.falcon = { lv: 1 };
    f.cards = f.cards || {};
    f.tickets = f.tickets || 0;
    f.pity = f.pity || 0;
    f.progress = f.progress || 0;
    f.resume = f.resume || 1;
    f.stats = Object.assign({}, d.stats, f.stats || {});
    return f;
  }
  function fleetSet(name, data) { set(name, 'th_fleet', data); }
  /* 获取（不存在则建默认）并返回 */
  function fleet(name) {
    let f = fleetGet(name);
    if (!f) { f = defaultFleet(); fleetSet(name, f); }
    return f;
  }

  return {
    list, current, ensureDefault, switchTo, get, set,
    fleet, fleetGet, fleetSet, defaultFleet,
    /* 测试/管理用：删除某玩家档案 */
    remove(name) {
      const names = list().filter(n => n !== name);
      saveList(names);
      if (current() === name && names.length) setCurrent(names[0]);
      for (const p of ['th_best', 'th_ach', 'th_stats', 'th_diff', 'th_fleet']) {
        try { localStorage.removeItem(key(p, name)); } catch (e) {}
      }
    },
  };
})();
