/* main.js —— 入口：缩放适配 / 输入 / UI / 主循环 */
'use strict';

(() => {
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');

  /* ---------- 画布缩放：保持 2:3 比例适配窗口 ---------- */
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    stage.style.width = cw + 'px';
    stage.style.height = ch + 'px';
    // 高分屏清晰度
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    game.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- UI 封装 ---------- */
  const $ = id => document.getElementById(id);
  const ui = {
    el: {
      hud: $('hud'), score: $('score'), best: $('best'),
      lives: $('hud-lives'), bombs: $('hud-bombs'), weapon: $('hud-weapon'),
      energy: $('hud-energy-fill'), diff: $('hud-diff'), combo: $('hud-combo'),
      stage: $('hud-stage'), buffs: $('hud-buffs'),
      achCount: $('ach-count'), overCombo: $('over-combo'), overAch: $('over-ach'),
      pauseScore: $('pause-score'), pauseStage: $('pause-stage'), pauseCombo: $('pause-combo'),
      btnMute: $('btn-mute'), btnShake: $('btn-shake'),
      overTime: $('over-time'), titleStats: $('title-stats'),
      curPlayer: $('cur-player'), pausePlayer: $('pause-player'),
      bossBar: $('boss-bar'), bossHp: $('boss-hp'),
      banner: $('wave-banner'),
      title: $('screen-title'), pause: $('screen-pause'), over: $('screen-over'),
      bestTitle: $('best-title'),
      overScore: $('over-score'), overKills: $('over-kills'), overWave: $('over-wave'),
      newBest: $('over-newbest'),
    },

    showScreen(name) {
      this.el.title.classList.toggle('hidden', name !== 'title');
      this.el.pause.classList.toggle('hidden', name !== 'pause');
      this.el.over.classList.toggle('hidden', name !== 'over');
      this.el.hud.classList.toggle('hidden', name === 'title');
    },
    setScore(v) { this.el.score.textContent = v; },
    setBest(v) { this.el.best.textContent = v; this.el.bestTitle.textContent = v; },
    setLives(n) {
      this.el.lives.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const d = document.createElement('span');
        d.className = 'pip pip-life';
        this.el.lives.appendChild(d);
      }
      this.el.lives.classList.toggle('danger', n <= 1);   // v11.0 低生命警示
      document.getElementById('stage').classList.toggle('low-hp', n <= 1);   // v11.2 全屏红光脉冲
    },
    setBombs(n) {
      this.el.bombs.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const d = document.createElement('span');
        d.className = 'pip pip-bomb';
        this.el.bombs.appendChild(d);
      }
      this.el.bombs.classList.toggle('empty', n === 0);   // v11.0 无炸弹灰显
    },
    setWeapon(type, lv) {
      const w = WEAPONS[type];
      this.el.weapon.textContent = `${w.name} Lv${lv}`;
      this.el.weapon.style.color = w.color;
      this.el.weapon.style.textShadow = `0 0 8px ${w.color}66`;
    },
    setEnergy(v) {
      this.el.energy.style.width = v + '%';
      this.el.energy.classList.toggle('full', v >= 100);   // v11.0 满能量脉冲
    },
    setDiff(diff) {
      this.el.diff.textContent = '· ' + diff.name + ' ·';
      this.el.diff.style.color = diff.color;
    },
    setStage(n) { this.el.stage.textContent = '第 ' + n + ' 关'; },
    // 增益栏（v11.1）：护盾/僚机/磁力/暴击 常驻显示，仅在内容变化时写 DOM
    updateBuffs(p) {
      const segs = [];
      if (p.shield > 0) segs.push(`<span style="color:#4ac8ff">盾×${p.shield}</span>`);
      if (p.drones > 0) segs.push(`<span style="color:#7affd4">◆${p.drones}</span>`);
      if (p.magnetT > 0) segs.push(`<span style="color:#b0ff7a">磁${Math.ceil(p.magnetT)}s</span>`);
      if (p.crit > 0) segs.push(`<span style="color:#ff7a7a">暴${Math.round(p.crit * 100)}%</span>`);
      const html = segs.join('<i class="sep"></i>');
      if (html !== this._buffHtml) { this._buffHtml = html; this.el.buffs.innerHTML = html; }
    },
    setCombo(n) {
      this.el.combo.textContent = n >= 3 ? `COMBO ×${n}` : '';
      this.el.combo.style.fontSize = n >= 10 ? '20px' : '15px';
      this.el.combo.style.color = n >= 10 ? '#ffe14a' : '#cfe9ff';
    },
    setAchCount(n) { this.el.achCount.textContent = n; },
    setPauseStats(score, stage, combo) {
      this.el.pauseScore.textContent = score;
      this.el.pauseStage.textContent = stage;
      this.el.pauseCombo.textContent = '×' + combo;
    },
    setMuteUI(m) {
      this.el.btnMute.textContent = m ? '🔇' : '🔊';
      this.el.btnMute.classList.toggle('muted', m);
    },
    setShakeUI(on) {
      this.el.btnShake.textContent = on ? '开' : '关';
      this.el.btnShake.classList.toggle('off', !on);
    },
    showBossBar() { this.el.bossBar.classList.remove('hidden'); this.el.bossHp.style.width = '100%'; },
    hideBossBar() { this.el.bossBar.classList.add('hidden'); },
    setBossName(name) { document.getElementById('boss-name').textContent = name; },
    setBossHp(frac) { this.el.bossHp.style.width = Math.max(0, frac * 100) + '%'; },
    showWaveBanner(text, isBoss, duration = 1400) {
      const b = this.el.banner;
      b.textContent = text;
      if (isBoss) { b.style.color = '#ffb3b3'; b.style.textShadow = '0 0 18px #ff5050, 0 0 40px #ff5050'; }
      else { b.style.color = ''; b.style.textShadow = ''; }
      b.classList.remove('hidden');
      // 重启动画
      b.style.animation = 'none';
      void b.offsetWidth;
      b.style.animation = 'banner-in .5s ease-out';
      clearTimeout(this._bannerT);
      this._bannerT = setTimeout(() => b.classList.add('hidden'), duration);
    },
    floatScore(x, y, text, color) { game.floats.push(new FloatText(x, y, text, color)); },
    setCurPlayer(n) {
      this.el.curPlayer.textContent = n;
      this.el.pausePlayer.textContent = n;
    },
    fmtTime(t) {
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      return m + '分' + (s < 10 ? '0' : '') + s + '秒';
    },
    showGameOver(score, kills, stage, isBest, maxCombo, newAch, playT, stats) {
      this.el.overScore.textContent = score;
      this.el.overKills.textContent = kills;
      this.el.overWave.textContent = stage;
      this.el.overCombo.textContent = '×' + maxCombo;
      this.el.overAch.textContent = newAch > 0 ? `+${newAch} 成就` : '—';
      this.el.overTime.textContent = this.fmtTime(playT || 0);
      this.el.newBest.classList.toggle('hidden', !isBest);
      document.getElementById('stage').classList.remove('low-hp');
      this.setBest(game.best);
      this.setTitleStats(stats);
      this.showScreen('over');
    },
    setTitleStats(st) {
      if (!st) return;
      this.el.titleStats.textContent = `累计出战 ${st.games} 局 · 击落 ${st.kills} · 最远第 ${st.bestStage} 关`;
    },
  };

  /* ---------- 游戏实例 ---------- */
  const game = new Game(canvas, ui);
  window.game = game; // 调试用
  ui.setBest(game.best);
  game.refreshProfile();   // v12.0 标题展示同步（最佳分/成就/战绩/难度/当前玩家）

  /* ---------- 键盘 ---------- */
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
  };
  window.addEventListener('keydown', e => {
    if (KEYMAP[e.code]) { game.input[KEYMAP[e.code]] = true; game.input.pointerActive = false; e.preventDefault(); }
    if (e.code === 'Space') { game.input.bombRequested = true; e.preventDefault(); }
    if (e.code === 'KeyE') { game.input.ultRequested = true; e.preventDefault(); }
    if (e.code === 'KeyM') { ui.setMuteUI(SFX.toggleMute()); e.preventDefault(); }   // v11.0 静音
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {   // v11.0 快捷键
      if (e.target && e.target.tagName === 'INPUT') return;   // v12.0 输入玩家名时不触发开局
      if (game.state === 'title' || game.state === 'gameover') startGame();
      else if (game.state === 'paused') { game.resume(); ui.showScreen('hud-only'); }
      e.preventDefault();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (game.state === 'playing') doPause();
      else if (game.state === 'paused') { game.resume(); ui.showScreen('hud-only'); }
    }
  });
  window.addEventListener('keyup', e => {
    if (KEYMAP[e.code]) game.input[KEYMAP[e.code]] = false;
  });

  /* ---------- 鼠标 ---------- */
  function canvasPos(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (cx - rect.left) / rect.width * W,
      y: (cy - rect.top) / rect.height * H,
    };
  }
  canvas.addEventListener('mousemove', e => {
    const p = canvasPos(e.clientX, e.clientY);
    game.input.pointerActive = true;
    game.input.px = p.x; game.input.py = p.y;
  });

  /* ---------- 触摸 ---------- */
  let lastTapT = 0;
  let holdTimer = 0;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    SFX.unlock();
    const t = e.touches[0];
    const p = canvasPos(t.clientX, t.clientY);
    game.input.pointerActive = true;
    game.input.px = p.x; game.input.py = p.y;
    // 双击放炸弹
    const now = performance.now();
    if (now - lastTapT < 280) game.input.bombRequested = true;
    lastTapT = now;
    // 长按 0.45s 释放必杀（v5.0，移动即取消）
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { game.input.ultRequested = true; }, 450);
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    clearTimeout(holdTimer);
    const t = e.touches[0];
    const p = canvasPos(t.clientX, t.clientY);
    game.input.px = p.x; game.input.py = p.y;
  }, { passive: false });
  canvas.addEventListener('touchend', e => { e.preventDefault(); clearTimeout(holdTimer); }, { passive: false });

  /* ---------- 按钮 ---------- */
  function startGame() {
    SFX.unlock();
    game.start();
    ui.showScreen('hud-only');
  }
  // 统一暂停入口（v11.0）：附带本局战绩到暂停界面
  function doPause() {
    if (game.state !== 'playing') return;
    game.pause();
    ui.setPauseStats(game.score, game.stage, game.maxCombo);
    ui.setShakeUI(game.shakeOn);
    ui.showScreen('pause');
  }
  $('btn-start').addEventListener('click', startGame);
  $('btn-retry').addEventListener('click', startGame);
  // 难度选择（v9.0）
  document.querySelectorAll('.btn-diff').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.btn-diff').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      game.setDifficulty(b.dataset.diff);
    });
  });
  const savedDiffBtn = document.querySelector(`.btn-diff[data-diff="${game.diffKey}"]`);
  if (savedDiffBtn) { document.querySelectorAll('.btn-diff').forEach(x => x.classList.remove('active')); savedDiffBtn.classList.add('active'); }
  $('btn-resume').addEventListener('click', () => { game.resume(); ui.showScreen('hud-only'); });
  $('btn-menu').addEventListener('click', () => { game.toTitle(); ui.showScreen('title'); });
  $('btn-quit').addEventListener('click', () => { game.toTitle(); ui.showScreen('title'); });
  // 中途直接退出：HUD ✕ → 暂停菜单（可继续或回主菜单）
  $('btn-exit').addEventListener('click', doPause);
  // 静音开关（v11.0）：按钮 + M 键共用，状态持久化
  $('btn-mute').addEventListener('click', () => ui.setMuteUI(SFX.toggleMute()));
  ui.setMuteUI(SFX.muted);
  // 页面切走自动暂停（v11.0）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) doPause();
  });
  // 屏幕震动开关（v11.3）
  $('btn-shake').addEventListener('click', () => {
    game.shakeOn = !game.shakeOn;
    try { localStorage.setItem('th_shake', game.shakeOn ? '1' : '0'); } catch (e) {}
    ui.setShakeUI(game.shakeOn);
  });

  /* ---------- 玩家档案 UI（v12.0） ---------- */
  const nameInput = $('name-input');
  /* 同步标题界面难度按钮高亮到当前玩家的已记忆难度（切人后 refreshProfile 不更新按钮态） */
  function syncDiffButtons() {
    document.querySelectorAll('.btn-diff').forEach(x => x.classList.remove('active'));
    const b = document.querySelector(`.btn-diff[data-diff="${game.diffKey}"]`);
    if (b) b.classList.add('active');
  }
  function applyName() {
    const n = Players.switchTo(nameInput.value);
    if (!n) return;
    nameInput.value = '';
    game.pname = n;
    game.refreshProfile();
    renderPlayerList();
    syncDiffButtons();
  }
  function renderPlayerList() {
    const wrap = $('player-list');
    wrap.innerHTML = '';
    for (const n of Players.list()) {
      const b = document.createElement('button');
      b.className = 'player-chip' + (n === game.pname ? ' active' : '');
      b.textContent = n;
      b.addEventListener('click', () => {
        game.pname = n;
        game.refreshProfile();
        renderPlayerList();
        syncDiffButtons();
      });
      wrap.appendChild(b);
    }
  }
  $('btn-name').addEventListener('click', applyName);
  nameInput.addEventListener('keydown', e => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); applyName(); }
  });
  game.refreshProfile();
  renderPlayerList();

  /* ---------- 服务器保活 + 关页自毁（v12.0） ---------- */
  // 仅 http(s) 运行模式启用（file:// 直开无服务器，跳过避免 CORS 报错）
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    // 页面常驻期间定时保活：间隔(2s) < 服务端宽限(4s)，刷新/关页竞态下旧页面的 /shutdown
    // beacon 即使晚于新页面的 /ping 到达，也会被下一次定时 /ping 取消，避免刷新误杀
    const ping = () => { try { fetch('/ping').catch(() => {}); } catch (e) {} };
    ping();
    setInterval(ping, 2000);
    window.addEventListener('pagehide', () => {
      try { navigator.sendBeacon('/shutdown', '1'); } catch (e) {}
    });
  }

  /* ---------- 主循环 ---------- */
  let lastT = performance.now();
  function loop(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    dt = Math.min(dt, 0.05); // 切后台回来防跳帧

    if (game.input.bombRequested) {
      game.input.bombRequested = false;
      game.useBomb();
    }
    if (game.input.ultRequested) {
      game.input.ultRequested = false;
      game.tryUltimate();
    }

    game.update(dt);
    game.render();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  ui.showScreen('title');
  requestAnimationFrame(loop);
})();
