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
  function startGame(stage) {
    SFX.unlock();
    game.start(stage || 1);        // v12.1 选关：传入起始关卡
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
  $('btn-start').addEventListener('click', () => startGame());
  $('btn-retry').addEventListener('click', () => startGame());
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

  /* ---------- 主界面信息功能（v12.1）：键位说明 / 玩法 / 选关 / 成就 ---------- */
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  // 触屏设备：主界面操作提示改为触屏说明（手机上键位提示更清楚）
  if (isTouch) {
    const hint = document.querySelector('#screen-title .menu-hint');
    if (hint) {
      hint.innerHTML =
        '<p>移动：手指拖动 &nbsp;|&nbsp; 射击：自动</p>' +
        '<p>炸弹：快速双击 &nbsp;|&nbsp; 必杀：长按（能量满时）</p>' +
        '<p>拾取道具换武器：W散弹 M导弹 V火神 O僚机 G磁力 C暴击</p>' +
        '<p>暂停：右上角 ✕ &nbsp;|&nbsp; 详细见「键位说明」</p>';
    }
  }
  const modal = $('modal'), modalTitle = $('modal-title'), modalBody = $('modal-body');
  function openModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.remove('hidden');
  }
  function closeModal() { modal.classList.add('hidden'); }
  $('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  function keysContent() {
    return (
      '<h4>移动</h4><p>' + (isTouch ? '手指在屏幕上拖动（战机跟随手指）' : '鼠标移动 / WASD / 方向键') + '</p>' +
      '<h4>射击</h4><p>自动开火，无需操作</p>' +
      '<h4>炸弹</h4><p>' + (isTouch ? '快速双击屏幕' : '空格键') + ' — 清屏大杀器（有数量上限，可拾取补充）</p>' +
      '<h4>必杀技</h4><p>' + (isTouch ? '长按屏幕约 0.45 秒（移动手指即取消）' : 'E 键') + ' — 能量满 100% 时释放</p>' +
      '<h4>武器与增益（拾取对应道具自动获得 / 升级）</h4>' +
      '<table><tr><th>道具</th><th>效果</th></tr>' +
      '<tr><td>W</td><td>散弹（扇形弹幕）</td></tr>' +
      '<tr><td>M</td><td>追踪导弹（自动索敌）</td></tr>' +
      '<tr><td>V</td><td>火神炮（高速直线）</td></tr>' +
      '<tr><td>O</td><td>僚机（编队火力）</td></tr>' +
      '<tr><td>G</td><td>磁力吸附（吸道具）</td></tr>' +
      '<tr><td>C</td><td>暴击（伤害翻倍）</td></tr></table>' +
      '<h4>暂停 / 静音</h4><p>' + (isTouch ? '点击右上角 ✕ 按钮暂停' : 'P / Esc / 右上角 ✕ 暂停；M 静音') + '</p>' +
      '<h4>其他</h4><p>Enter：开始 / 继续 / 快速再战</p>'
    );
  }
  function howtoContent() {
    return (
      '<h4>目标</h4><p>操控战机躲避弹幕、击落敌机，尽可能多过关。关卡无限递增，越打越难。</p>' +
      '<h4>武器与成长</h4><p>击落敌机掉落武器道具（W散弹 / M追踪导弹 / V火神炮），拾取同类道具可升级武器；' +
      'O僚机 / G磁力 / C暴击 / 护盾等增益提升战力。</p>' +
      '<h4>能量必杀</h4><p>自动射击积攒能量，满 100% 后释放必杀激光清屏。</p>' +
      '<h4>炸弹</h4><p>保命清屏技，开局自带，可拾取补充。</p>' +
      '<h4>连击与成就</h4><p>连续击落敌机保持连击（停止击落会清零），高连击挑战高分；共 8 个成就。</p>' +
      '<h4>关卡结构</h4><p>每关 2 波常规战斗；每 5 关是 Boss 关；第 25 关是终极 Boss「蚀日·真形态」。' +
      '部分关卡第 2 波会有中场 Boss 或陨石雨 / 蜂群事件波。</p>' +
      '<h4>难度</h4><p>三档：轻松（弹速慢 / 掉落高）/ 标准 / 炼狱（弹速快 / 得分高），按玩家记忆。</p>'
    );
  }
  let selStage = 1;
  function stageContent() {
    const cells = [];
    for (let i = 1; i <= 25; i++) {
      cells.push('<div class="stage-cell' + (i === selStage ? ' active' : '') + (i % 5 === 0 ? ' boss' : '') + '" data-s="' + i + '">' + i + '</div>');
    }
    return (
      '<p style="text-align:center;opacity:.85">选择起始关卡（第 5/10/15/20/25 关为 Boss 关）</p>' +
      '<div class="stage-grid">' + cells.join('') + '</div>' +
      '<p class="stage-sel" style="text-align:center;margin:2px 0 6px">当前选择：第 <b style="color:#ffe14a">' + selStage + '</b> 关</p>' +
      '<button class="btn" id="stage-go" style="min-width:150px;padding:10px 26px;font-size:15px;letter-spacing:4px">开始第 ' + selStage + ' 关</button>'
    );
  }
  function bindStageGrid() {
    modalBody.querySelectorAll('.stage-cell').forEach(c => {
      c.addEventListener('click', () => {
        selStage = parseInt(c.dataset.s, 10);
        modalBody.querySelectorAll('.stage-cell').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        const go = modalBody.querySelector('#stage-go');
        if (go) go.textContent = '开始第 ' + selStage + ' 关';
        const selP = modalBody.querySelector('.stage-sel');
        if (selP) selP.innerHTML = '当前选择：第 <b style="color:#ffe14a">' + selStage + '</b> 关';
      });
    });
    const go = modalBody.querySelector('#stage-go');
    if (go) go.addEventListener('click', () => { closeModal(); startGame(selStage); });
  }
  function achContent() {
    const got = game._ach || [];
    const rows = ACHS.map(a => {
      const has = got.indexOf(a.id) >= 0;
      return (
        '<div class="ach-item' + (has ? '' : ' locked') + '">' +
        '<div class="ach-ico">' + (has ? '★' : '☆') + '</div>' +
        '<div class="ach-txt"><div class="ach-name">' + a.name + (has ? ' <span style="color:#4aff8a;font-size:11px">已解锁</span>' : '') + '</div>' +
        '<div class="ach-desc">' + a.desc + '</div></div></div>'
      );
    }).join('');
    return (
      '<p style="text-align:center;color:#9db8d8;margin:2px 0 8px">玩家「' + game.pname + '」已解锁 <b style="color:#ffe14a">' + got.length + '</b> / ' + ACHS.length + '</p>' + rows
    );
  }
  $('btn-keys').addEventListener('click', () => openModal('键位说明', keysContent()));
  $('btn-howto').addEventListener('click', () => openModal('玩法介绍', howtoContent()));
  $('btn-stage').addEventListener('click', () => { selStage = 1; openModal('选择关卡', stageContent()); bindStageGrid(); });
  $('btn-ach').addEventListener('click', () => openModal('成就', achContent()));

  /* ---------- 服务器保活 + 关页自毁（v12.0） ---------- */
  // 仅 http(s) 运行模式启用（file:// 直开无服务器，跳过避免 CORS 报错）；
  // 静态托管（如 GitHub Pages）无自毁服务器：/ping 非 200 即判定无服务器，自动停用保活与信标，
  // 避免每 2s 一次的 404 请求；本地 server.py 模式 /ping 恒 200，保活/关页杀服照常工作
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    let serverAlive = true;
    let keepaliveTimer = null;
    const stopKeepalive = () => {
      serverAlive = false;
      if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
      window.removeEventListener('pagehide', onHide);
    };
    const ping = async () => {
      if (!serverAlive) return;
      try {
        const r = await fetch('/ping', { cache: 'no-store' });
        if (!r.ok) stopKeepalive();
      } catch (e) { stopKeepalive(); }
    };
    const onHide = () => { try { navigator.sendBeacon('/shutdown', '1'); } catch (e) {} };
    // 页面常驻期间定时保活：间隔(2s) < 服务端宽限(4s)，刷新/关页竞态下旧页面的 /shutdown
    // beacon 即使晚于新页面的 /ping 到达，也会被下一次定时 /ping 取消，避免刷新误杀
    ping();
    keepaliveTimer = setInterval(ping, 2000);
    window.addEventListener('pagehide', onHide);
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
