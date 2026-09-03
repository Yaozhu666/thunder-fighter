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

  return {
    list, current, ensureDefault, switchTo, get, set,
    /* 测试/管理用：删除某玩家档案 */
    remove(name) {
      const names = list().filter(n => n !== name);
      saveList(names);
      if (current() === name && names.length) setCurrent(names[0]);
      for (const p of ['th_best', 'th_ach', 'th_stats', 'th_diff']) {
        try { localStorage.removeItem(key(p, name)); } catch (e) {}
      }
    },
  };
})();
