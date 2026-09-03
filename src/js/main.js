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
      if (n > 5) {
        // v13.0 数量 >5 显示「💣×n」省 HUD 空间
        const d = document.createElement('span');
        d.className = 'pip pip-bomb';
        d.textContent = '💣×' + n;
        this.el.bombs.appendChild(d);
      } else {
        for (let i = 0; i < n; i++) {
          const d = document.createElement('span');
          d.className = 'pip pip-bomb';
          this.el.bombs.appendChild(d);
        }
      }
      this.el.bombs.classList.toggle('empty', n === 0);   // v11.0 无炸弹灰显
    },
    setWeapon(type, lv) {
      const w = WEAPONS[type];
      const gm = window.game;
      const p = gm && gm.player ? gm.player : null;
      const ship = p && p.ship ? p.ship : null;
      const lvTxt = lv >= 10 ? 'MAX' : 'Lv' + lv;   // v13.0 满级显示 MAX
      this.el.weapon.textContent = ship ? `${ship.name} Lv${p.shipLv} · ${w.name} ${lvTxt}` : `${w.name} ${lvTxt}`;
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
      if (p.passiveMagnet) segs.push(`<span style="color:#b0ff7a">磁力</span>`);   // v13.0 幻影内置磁力常驻
      else if (p.magnetT > 0) segs.push(`<span style="color:#b0ff7a">磁${Math.ceil(p.magnetT)}s</span>`);
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
      if (this.el.curPlayer) this.el.curPlayer.textContent = n;   // v13.1 取名 UI 暂隐藏，判空
      if (this.el.pausePlayer) this.el.pausePlayer.textContent = n;
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

  /* ---------- 玩家档案（v13.1 暂时隐藏取名 UI，等联机上线再启用；默认单玩家「玩家1」） ---------- */
  function syncDiffButtons() {
    document.querySelectorAll('.btn-diff').forEach(x => x.classList.remove('active'));
    const b = document.querySelector(`.btn-diff[data-diff="${game.diffKey}"]`);
    if (b) b.classList.add('active');
  }
  game.pname = Players.ensureDefault();
  game.refreshProfile();
  syncDiffButtons();

  /* ---------- 主界面信息功能（v12.1）：键位 / 玩法 / 选关 / 成就 / 战机 / 抽卡 / 背包 ---------- */
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
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
      '<h4>目标</h4><p>操控战机躲避弹幕、击落敌机，尽可能多过关。第 25 关是终极 Boss「蚀日·真形态」，通关即全通。</p>' +
      '<h4>武器与成长</h4><p>击落敌机掉落武器道具（W散弹 / M追踪导弹 / V火神炮），拾取同类道具可升级武器；' +
      'O僚机 / G磁力 / C暴击 / 护盾等增益提升战力。火力 Lv1~5 是弹幕形态成长，Lv6~10 是伤害强化（越升越难）。</p>' +
      '<h4>战机系统（v13.0）</h4><p>主界面「战机」可抽卡获得战机（1 券 = 1 抽，10 抽保底高级）。' +
      '猎鹰/风暴/毒牙为普通战机（对应 V/W/M），幻影/雷霆/暗夜为高级战机（专属武器，无法局内获得，武器道具自动回收 +300 分）。' +
      '抽到重复战机得卡，可用卡升级战机：1~5 级每级 1 张、6~9 级每级 2 张、10 级 3 张，满级 MAX，伤害 +59.5%、得分 +20%。' +
      '也可消耗 1 张卡兑换「开局储备」（炸弹+1/护盾+1/生命+1）。</p>' +
      '<h4>能量必杀</h4><p>自动射击积攒能量，满 100% 后释放必杀激光清屏。</p>' +
      '<h4>炸弹</h4><p>保命清屏技，开局自带 3 颗（上限 5，满后拾取 +100 分；对 Boss 伤害降低）。</p>' +
      '<h4>连击与成就</h4><p>连续击落敌机保持连击；成就分「数值类」（可升级，奖励更多券）与「一次性」两类。</p>' +
      '<h4>关卡与进度</h4><p>每关 2 波常规战斗；每 5 关是 Boss 关。选关界面可主动选关：已打过的关卡可继续推进，' +
      '未打过的关卡通关不计入连续进度（直达第 25 关打赢即全通除外）。</p>' +
      '<h4>难度</h4><p>三档：轻松（弹速慢 / 掉落高）/ 标准 / 炼狱（弹速快 / 得分高），按玩家记忆。</p>'
    );
  }
  let selStage = 1;
  function stageContent() {
    const f = game.fleet();
    const prog = f.progress || 0;
    const resume = f.resume || 1;
    const cells = [];
    for (let i = 1; i <= 25; i++) {
      let cls = 'stage-cell';
      if (i === selStage) cls += ' active';
      if (i % 5 === 0) cls += ' boss';
      if (i <= prog) cls += ' done';            // v13.0 已通关
      if (i === resume) cls += ' resume';       // v13.0 续关点（打过输掉，可续，不算跳过）
      const skip = i > prog + 1 && i !== resume; // v13.0 跳关（未打过）——续关点除外
      if (skip) cls += ' skip';
      cells.push('<div class="' + cls + '" data-s="' + i + '" data-skip="' + (skip ? 1 : 0) + '">' + i + '</div>');
    }
    const progTxt = prog >= 25 ? '<b style="color:#4aff8a">已全通 25 关</b>'
      : '连续通关 <b style="color:#4aff8a">' + prog + '</b> 关' + (resume > 1 ? ' · 继续点第 <b style="color:#7ac8ff">' + resume + '</b> 关' : '');
    return (
      '<p style="text-align:center;opacity:.9;margin:2px 0 6px">' + progTxt + '</p>' +
      '<div class="stage-grid">' + cells.join('') + '</div>' +
      '<p class="stage-sel" style="text-align:center;margin:4px 0 2px">当前选择：第 <b style="color:#ffe14a">' + selStage + '</b> 关</p>' +
      '<p id="stage-note" style="text-align:center;min-height:16px;font-size:11px;color:#ff9a7a;margin:0 0 6px"></p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<button class="btn" id="stage-resume" style="min-width:120px;padding:10px 18px;font-size:14px" ' + (resume > 1 && resume <= 25 ? '' : 'disabled') + '>继续 第 ' + resume + ' 关</button>' +
      '<button class="btn" id="stage-go" style="min-width:150px;padding:10px 26px;font-size:15px;letter-spacing:4px">开始第 ' + selStage + ' 关</button>' +
      '</div>'
    );
  }
  function bindStageGrid() {
    const noteEl = () => modalBody.querySelector('#stage-note');
    modalBody.querySelectorAll('.stage-cell').forEach(c => {
      c.addEventListener('click', () => {
        selStage = parseInt(c.dataset.s, 10);
        modalBody.querySelectorAll('.stage-cell').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        const go = modalBody.querySelector('#stage-go');
        if (go) go.textContent = '开始第 ' + selStage + ' 关';
        const selP = modalBody.querySelector('.stage-sel');
        if (selP) selP.innerHTML = '当前选择：第 <b style="color:#ffe14a">' + selStage + '</b> 关';
        if (noteEl()) {
          const f = game.fleet();
          const prog = f.progress || 0;
          noteEl().textContent = c.dataset.skip === '1'
            ? (selStage === 25 ? '直达第 25 关：打赢即全通 ✓' : '此前关卡未打，从第 ' + selStage + ' 关开始（通关不计入连续进度）')
            : (selStage === 1 ? '从第 1 关开始' : '第 ' + selStage + ' 关起步（已打过，通关续接进度）');
        }
      });
    });
    const go = modalBody.querySelector('#stage-go');
    if (go) go.addEventListener('click', () => { closeModal(); startGame(selStage); });
    const resumeBtn = modalBody.querySelector('#stage-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => { const r = game.fleet().resume || 1; closeModal(); startGame(r); });
    // 初始提示
    if (noteEl()) {
      const f = game.fleet();
      const prog = f.progress || 0;
      noteEl().textContent = selStage > prog + 1
        ? (selStage === 25 ? '直达第 25 关：打赢即全通 ✓' : '此前关卡未打，从第 ' + selStage + ' 关开始（通关不计入连续进度）')
        : (selStage === 1 ? '从第 1 关开始' : '第 ' + selStage + ' 关起步（已打过，通关续接进度）');
    }
  }
  function achContent() {
    const ach = game._ach || {};
    const unlockedCount = game.achCount();
    const fmt = n => (n || 0).toLocaleString();
    const numRows = ACH_NUM.map(a => {
      const lv = ach[a.id] || 0;
      const cur = game.fleet().stats[a.stat] || 0;
      const lvTxt = lv > 0
        ? '<span style="color:#4aff8a">Lv' + lv + (lv >= 3 ? ' · MAX' : '') + '</span>'
        : '<span style="color:#5a6b7a">未解锁</span>';
      const prog = a.lv.map((t, i) => '<span style="color:' + (cur >= t ? '#4aff8a' : '#5a6b7a') + '">' + fmt(t) + '</span>').join(' → ');
      return (
        '<div class="ach-item' + (lv > 0 ? '' : ' locked') + '">' +
        '<div class="ach-ico">' + (lv > 0 ? '★' : '☆') + '</div>' +
        '<div class="ach-txt"><div class="ach-name">' + a.name + ' ' + lvTxt + '</div>' +
        '<div class="ach-desc">' + a.desc + ' 当前 <b style="color:#ffe14a">' + fmt(cur) + '</b> / ' + prog + '</div>' +
        '<div class="ach-desc" style="color:#ffd76a">奖励：Lv1 +2 · Lv2 +3 · Lv3 +5 券</div></div></div>'
      );
    }).join('');
    const onceRows = ACH_ONCE.map(a => {
      const has = (ach[a.id] || 0) > 0;
      return (
        '<div class="ach-item' + (has ? '' : ' locked') + '">' +
        '<div class="ach-ico">' + (has ? '★' : '☆') + '</div>' +
        '<div class="ach-txt"><div class="ach-name">' + a.name + (has ? ' <span style="color:#4aff8a;font-size:11px">已解锁</span>' : '') + '</div>' +
        '<div class="ach-desc">' + a.desc + '</div>' +
        '<div class="ach-desc" style="color:#ffd76a">奖励：+' + (a.tier === 2 ? 5 : 2) + ' 券</div></div></div>'
      );
    }).join('');
    return (
      '<p style="text-align:center;color:#9db8d8;margin:2px 0 8px">已解锁 <b style="color:#ffe14a">' + unlockedCount + '</b> / ' + (ACH_NUM.length + ACH_ONCE.length) + ' 项</p>' +
      '<h4 style="color:#4aff8a;margin:8px 0 4px">数值类（可升级）</h4>' + numRows +
      '<h4 style="color:#ffe14a;margin:10px 0 4px">一次性</h4>' + onceRows
    );
  }
  /* ---------- 战机系统（v13.0） ---------- */
  function fleetContent() {
    const f = game.fleet();
    const cards = f.cards || {};
    const rows = Object.keys(SHIPS).map(id => {
      const s = SHIPS[id];
      const own = f.owned[id];
      const lv = own ? own.lv : 0;
      const isEq = f.equipped === id;
      const high = s.rare !== 'common';
      const lvTxt = lv === 0 ? '未获得' : (lv >= 10 ? 'MAX' : 'Lv' + lv);
      const upCost = lv > 0 && lv < 10 ? SHIP_UP_COST(lv) : 0;
      const hasCards = upCost > 0 && (cards[id] || 0) >= upCost;
      return (
        '<div class="ship-card' + (high ? ' ship-high' : '') + (isEq ? ' ship-eq' : '') + (lv === 0 ? ' ship-locked' : '') + '" data-ship="' + id + '">' +
        '<div class="ship-head"><span class="ship-name">' + s.name + '</span><span class="ship-lv" style="color:' + (lv >= 10 ? '#ff7ad9' : (lv === 0 ? '#5a6b7a' : '#ffe14a')) + '">' + lvTxt + '</span></div>' +
        '<div class="ship-weapon" style="color:' + WEAPONS[s.weapon].color + '">' + WEAPONS[s.weapon].name + (high ? '（专属）' : '') + '</div>' +
        '<div class="ship-desc">' + s.desc + '</div>' +
        '<div class="ship-rare">' + (high ? '★ 稀有 · 被动：' + (s.passiveText || '') : '普通战机') + '</div>' +
        (lv > 0
          ? '<div class="ship-acts"><button class="mini" data-act="eq">' + (isEq ? '已装备' : '装备') + '</button>' +
            (lv < 10 ? '<button class="mini" data-act="up"' + (hasCards ? '' : ' disabled') + '>升级 需' + upCost + '卡·持' + (cards[id] || 0) + '</button>' : '<button class="mini" disabled>已满级</button>') + '</div>'
          : '<div class="ship-acts"><button class="mini" disabled>未获得 · 去抽卡</button></div>') +
        '</div>'
      );
    }).join('');
    return (
      '<p style="text-align:center;color:#9db8d8;margin:2px 0 8px">当前装备：<b style="color:#4aff8a">' + SHIPS[f.equipped].name + '</b> · 券 <b style="color:#ffe14a">' + f.tickets + '</b> 张</p>' +
      '<div class="ship-grid">' + rows + '</div>' +
      '<p style="text-align:center;color:#5a6b7a;font-size:11px;margin:8px 0 0">升级消耗：1~5级每级1张 / 6~9级每级2张 / 10级3张。抽卡在「抽卡」，卡/券/兑换在「背包」</p>'
    );
  }
  function fleetResultBox(title, color, sub) {
    const old = document.querySelector('#gacha-result');
    if (old) old.remove();
    const box = document.createElement('div');
    box.id = 'gacha-result';
    box.style.cssText = 'position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:99;background:#0b1526;border:2px solid ' + color + ';border-radius:14px;padding:16px 22px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.6);max-width:80vw';
    box.innerHTML = '<div style="font-size:15px;color:' + color + ';margin-bottom:6px">' + title + '</div>' +
      (sub ? '<div style="color:#9db8d8;font-size:12px;margin-bottom:8px">' + sub + '</div>' : '') +
      '<button class="btn" style="padding:7px 22px;font-size:13px" id="gacha-ok">确定</button>';
    document.body.appendChild(box);
    return box;
  }
  function bindFleet() {
    const gm = game;
    const re = () => { openModal('战机', fleetContent()); bindFleet(); };
    modalBody.querySelectorAll('[data-act="eq"]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.closest('.ship-card').dataset.ship;
        if (gm.equipShip(id)) re();
      });
    });
    modalBody.querySelectorAll('[data-act="up"]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.closest('.ship-card').dataset.ship;
        const r = gm.upgradeShip(id);
        if (r) re();
        else { const box = fleetResultBox('升级失败', '#ff9a3c', '持有的 ' + SHIPS[id].name + ' 卡不足'); box.querySelector('#gacha-ok').onclick = () => box.remove(); }
      });
    });
  }

  /* ---------- 抽卡独立界面（v13.1） ---------- */
  function gachaContent() {
    const f = game.fleet();
    const toPity = Math.max(0, 10 - (f.pity || 0));
    return (
      '<p style="text-align:center;color:#9db8d8;margin:2px 0 8px">战机券 <b style="color:#ffe14a;font-size:18px">' + f.tickets + '</b> 张 · 再抽 <b style="color:#7ac8ff">' + toPity + '</b> 抽保底高级</p>' +
      '<div style="text-align:center;margin:0 0 10px"><button class="btn" id="gacha-go" style="min-width:180px;padding:12px 30px;font-size:16px;letter-spacing:3px"' + (f.tickets > 0 ? '' : ' disabled') + '>抽 1 次（1 券）</button></div>' +
      '<h4 style="color:#ffe14a;margin:6px 0 4px">卡池概率</h4>' +
      '<table class="gacha-table"><tr><th>战机</th><th>稀有度</th><th>概率</th></tr>' +
      '<tr><td style="color:#cfe9ff">猎鹰</td><td>普通</td><td>26%</td></tr>' +
      '<tr><td style="color:#cfe9ff">风暴</td><td>普通</td><td>27%</td></tr>' +
      '<tr><td style="color:#cfe9ff">毒牙</td><td>普通</td><td>27%</td></tr>' +
      '<tr><td style="color:#ff9ad9">幻影</td><td>稀有</td><td>9%</td></tr>' +
      '<tr><td style="color:#ffd24a">雷霆</td><td>史诗</td><td>6%</td></tr>' +
      '<tr><td style="color:#ff8ad4">暗夜</td><td>传说</td><td>5%</td></tr>' +
      '</table>' +
      '<p style="text-align:center;color:#5a6b7a;font-size:11px;margin:6px 0 0">抽到新战机即拥有；重复抽到得 1 张卡（存背包）。高级合计 20%，10 抽必出。</p>'
    );
  }
  function bindGacha() {
    const gm = game;
    const b = modalBody.querySelector('#gacha-go');
    if (!b) return;
    b.addEventListener('click', () => {
      const r = gm.gacha();
      if (!r) return;
      const s = SHIPS[r.id];
      const box = fleetResultBox(
        (r.isNew ? '✦ 新战机「' + s.name + '」' : '获得 ' + s.name + ' 卡 ×1') + (r.isHigh ? ' ★稀有！' : ''),
        r.isHigh ? '#ff7ad9' : '#ffe14a',
        s.desc + '（' + WEAPONS[s.weapon].name + (r.isHigh ? '·专属' : '') + '）'
      );
      box.querySelector('#gacha-ok').onclick = () => { box.remove(); openModal('抽卡', gachaContent()); bindGacha(); };
    });
  }

  /* ---------- 背包界面（v13.1）：卡 / 券 / 兑换开局储备 ---------- */
  function bagContent() {
    const f = game.fleet();
    const cards = f.cards || {};
    const hasCard = Object.keys(cards).some(k => cards[k] > 0);
    const cardRows = Object.keys(SHIPS).map(id => {
      const s = SHIPS[id];
      const n = cards[id] || 0;
      return (
        '<div class="bag-row' + (n > 0 ? '' : ' bag-empty') + '">' +
        '<span class="bag-name" style="color:' + WEAPONS[s.weapon].color + '">' + s.name + ' 卡</span>' +
        '<span class="bag-n">×' + n + '</span>' +
        '</div>'
      );
    }).join('');
    return (
      '<p style="text-align:center;color:#9db8d8;margin:2px 0 8px">战机券 <b style="color:#ffe14a;font-size:18px">' + f.tickets + '</b> 张 · 保底计数 <b style="color:#7ac8ff">' + (f.pity || 0) + '</b>/10</p>' +
      '<div style="text-align:center;margin:0 0 8px"><button class="btn" id="bag-redeem" style="min-width:210px;padding:10px 24px;font-size:14px"' + (hasCard ? '' : ' disabled') + '>兑换开局储备（消耗 1 张卡）</button></div>' +
      '<p style="text-align:center;color:#5a6b7a;font-size:11px;margin:0 0 6px">兑换后本局开局 炸弹+1 / 护盾+1 / 生命+1（仅本局）</p>' +
      '<h4 style="color:#ffe14a;margin:4px 0 4px">持有卡</h4>' +
      '<div class="bag-list">' + cardRows + '</div>'
    );
  }
  function bindBag() {
    const gm = game;
    const re = () => { openModal('背包', bagContent()); bindBag(); };
    const b = modalBody.querySelector('#bag-redeem');
    if (b) b.addEventListener('click', () => {
      const r = gm.redeemStarter();
      if (!r) return;
      const box = fleetResultBox('兑换成功', '#4aff8a', '本局开局 炸弹+1 / 护盾+1 / 生命+1（仅本局，选关开始后生效）');
      box.querySelector('#gacha-ok').onclick = () => { box.remove(); re(); };
    });
  }

  $('btn-keys').addEventListener('click', () => openModal('键位说明', keysContent()));
  $('btn-howto').addEventListener('click', () => openModal('玩法介绍', howtoContent()));
  $('btn-stage').addEventListener('click', () => { selStage = 1; openModal('选择关卡', stageContent()); bindStageGrid(); });
  // v13.1 成就入口并入主界面「★ 成就」数字处（点击进入）
  const achEntry = $('btn-ach');
  if (achEntry) achEntry.addEventListener('click', () => openModal('成就', achContent()));
  $('btn-fleet').addEventListener('click', () => { openModal('战机', fleetContent()); bindFleet(); });
  $('btn-gacha').addEventListener('click', () => { openModal('抽卡', gachaContent()); bindGacha(); });
  $('btn-bag').addEventListener('click', () => { openModal('背包', bagContent()); bindBag(); });

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
