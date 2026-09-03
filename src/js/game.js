/* game.js —— 游戏核心：主循环 / 波次 / 碰撞 / 渲染 */
'use strict';

/* 难度档位（v9.0） */
const DIFFS = {
  easy:   { name: '轻松', color: '#4aff8a', bSp: 0.80, cd: 1.25, dropMul: 1.30, scoreMul: 0.80, hpMul: 0.85 },
  normal: { name: '标准', color: '#6ef3ff', bSp: 1.00, cd: 1.00, dropMul: 1.00, scoreMul: 1.00, hpMul: 1.00 },
  hard:   { name: '炼狱', color: '#ff5a5a', bSp: 1.18, cd: 0.78, dropMul: 0.75, scoreMul: 1.60, hpMul: 1.25 },
};

/* 成就（v10.0） */
const ACHS = [
  { id: 'elite1',    name: '精英猎手',   desc: '击落一架精英机' },
  { id: 'drone2',    name: '编队司令',   desc: '同时拥有 2 架僚机' },
  { id: 'beam1',     name: '雷霆初鸣',   desc: '首次释放必杀' },
  { id: 'stage10',   name: '深入敌阵',   desc: '抵达第 10 关' },
  { id: 'boss5',     name: '舰队终结者', desc: '单局击落 5 个 Boss' },
  { id: 'combo25',   name: '连击大师',   desc: '单局连击达到 25' },
  { id: 'score100k', name: '十万大名',   desc: '单局得分突破 10 万' },
  { id: 'prime',     name: '蚀日终结者', desc: '击落蚀日·真形态' },
];
/* 档案与设备键：档案数据经 Players 按玩家隔离（v12.0） */

class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.ui = ui;

    this.state = 'title';          // title | playing | paused | gameover
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.best = 0;

    this.combo = 0;                // 连击（v10.0）
    this.comboT = 0;               // 连击窗口
    this.maxCombo = 0;
    this.bossKills = 0;
    this._ach = Players.get(this.pname, 'th_ach', []);   // v12.0 按玩家隔离
    this.newAch = [];

    this.pname = Players.ensureDefault();   // v12.0 当前玩家名（一个名字=一个玩家）
    let savedDiff = Players.get(this.pname, 'th_diff', 'normal');
    this.diffKey = DIFFS[savedDiff] ? savedDiff : 'normal';
    this.diff = DIFFS[this.diffKey];

    this.player = new Player();
    this.bullets = [];
    this.pendingBullets = [];      // 带延迟的子弹
    this.enemies = [];
    this.boss = null;
    this.powerups = [];
    this.particles = [];
    this.floats = [];
    this.stars = [];

    this.wave = 0;                 // 总波次计数
    this.stage = 1;                // 当前关卡（1 起，无限）
    this.waveInStage = 0;          // 关内波次 1~3 常规，4=Boss
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.enemyScale = 1;           // 随关卡增强的系数
    this.bossWarnT = 0;
    this.beam = null;              // 必杀激光状态（v5.0）
    this.miniBoss = null;          // 中场 Boss（v6.0）

    this.shake = 0;
    this.flashWhite = 0;
    this.bombFlash = 0;

    this.input = {
      left: false, right: false, up: false, down: false,
      pointerActive: false, px: 0, py: 0,
      bombRequested: false,
    };

    this._initStars();
    this._makeVignette();
    this.shoot = null;             // 流星点缀（v11.2）
    this.shootCd = rand(3, 8);
    this.shakeOn = true;           // 屏幕震动开关（v11.3，持久化）
    try { this.shakeOn = localStorage.getItem('th_shake') !== '0'; } catch (e) {}
    this.bombRing = 0;             // 炸弹冲击波（v11.3）
    this.playT = 0;                // 本局游玩时长秒（v11.4）
  }

  /* 暗角贴图：预渲染一次，避免每帧径向渐变（v11.2） */
  _makeVignette() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const vg = c.getContext('2d');
    const grad = vg.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.74);
    grad.addColorStop(0, 'rgba(0,0,10,0)');
    grad.addColorStop(1, 'rgba(0,0,10,0.42)');
    vg.fillStyle = grad;
    vg.fillRect(0, 0, W, H);
    this._vignette = c;
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      const layer = irand(0, 2);
      this.stars.push({
        x: rand(0, W),
        y: rand(0, H),
        speed: [26, 60, 120][layer],
        size: [1, 1.6, 2.2][layer],
        alpha: [0.35, 0.55, 0.9][layer],
      });
    }
  }

  /* ---------- 生命周期 ---------- */
  reset() {
    this.player = new Player();
    this.bullets = [];
    this.pendingBullets = [];
    this.enemies = [];
    this.boss = null;
    this.powerups = [];
    this.particles = [];
    this.floats = [];
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.stage = 1;
    this.waveInStage = 0;
    this.waveTimer = 1.2;          // 立即开第一波
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.enemyScale = 1;
    this.shake = 0;
    this.flashWhite = 0;
    this.bombFlash = 0;
    this.bossWarnT = 0;
    this.beam = null;
    this.miniBoss = null;
    this.playT = 0;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.bossKills = 0;
    this.newAch = [];
    this.ui.setScore(0);
    this.ui.setLives(this.player.lives);
    this.ui.setBombs(this.player.bombs);
    this.ui.setWeapon(this.player.weapon, this.player.power);
    this.ui.setEnergy(0);
    this.ui.setDiff(this.diff);
    this.ui.setStage(this.stage);
    this.ui.setCombo(0);
    this.ui.updateBuffs(this.player);
    this.ui.hideBossBar();
  }

  start() {
    this.reset();
    this.state = 'playing';
  }

  pause()  { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }
  toTitle(){ this.state = 'title'; }

  /* ---------- 玩家档案（v12.0） ---------- */
  setDifficulty(key) {
    if (!DIFFS[key]) return;
    this.diffKey = key;
    this.diff = DIFFS[key];
    Players.set(this.pname, 'th_diff', key);   // 难度按玩家记忆
    this.ui.setDiff(this.diff);
  }

  /* 切换玩家后刷新档案数据与展示 */
  refreshProfile() {
    const n = this.pname;
    this.best = Players.get(n, 'th_best', 0);
    this._ach = Players.get(n, 'th_ach', []);
    this.newAch = [];
    const d = Players.get(n, 'th_diff', 'normal');
    this.diffKey = DIFFS[d] ? d : 'normal';
    this.diff = DIFFS[this.diffKey];
    this.ui.setBest(this.best);
    this.ui.setAchCount(this._ach.length);
    this.ui.setDiff(this.diff);
    this.ui.setTitleStats(this.loadStats());
    this.ui.setCurPlayer(n);
  }

  /* ---------- 成就（v10.0） ---------- */
  hasAch(id) { return this._ach.indexOf(id) >= 0; }
  unlock(id) {
    if (this.hasAch(id)) return;
    this._ach.push(id);
    Players.set(this.pname, 'th_ach', this._ach);   // v12.0 按玩家存储
    const a = ACHS.find(x => x.id === id);
    if (a) {
      this.newAch.push(id);
      this.ui.showWaveBanner(`★ 成就解锁：${a.name}`, false, 2200);
      this.ui.setAchCount(this._ach.length);
    }
  }

  gameOver() {
    this.state = 'gameover';
    SFX.gameover();
    const isBest = this.score > this.best;
    if (isBest) { this.best = this.score; Players.set(this.pname, 'th_best', this.score); }   // v12.0 按玩家存储
    // 累计战绩（v11.4）
    const st = this.loadStats();
    st.games += 1;
    st.kills += this.kills;
    st.bestStage = Math.max(st.bestStage || 1, this.stage);
    st.bestCombo = Math.max(st.bestCombo || 0, this.maxCombo);
    Players.set(this.pname, 'th_stats', st);
    this.ui.showGameOver(this.score, this.kills, this.stage, isBest, this.maxCombo, this.newAch.length, this.playT, st);
  }

  loadStats() {
    return Players.get(this.pname, 'th_stats', { games: 0, kills: 0, bestStage: 1, bestCombo: 0 });
  }

  /* ---------- 生成接口 ---------- */
  spawnBullet(owner, x, y, vx, vy, r, color, delay = 0, opts = null) {
    if (owner === 'enemy' && this.diff.bSp !== 1) {   // v9.0 难度：敌弹速
      vx *= this.diff.bSp; vy *= this.diff.bSp;
    }
    if (delay > 0) {
      this.pendingBullets.push({ owner, x, y, vx, vy, r, color, delay, opts });
    } else {
      const b = new Bullet(owner, x, y, vx, vy, r, color);
      if (opts) Object.assign(b, opts);
      this.bullets.push(b);
    }
  }

  /* 追踪导弹索敌：最近的存活敌机或 Boss */
  nearestTarget(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.y < -20) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss && this.boss.phase > 0 && !this.boss.dead) {
      const d = dist2(x, y, this.boss.x, this.boss.y);
      if (d < bd) best = this.boss;
    }
    return best;
  }

  spawnParticles(x, y, n, color, size = 3, life = 0.5) {
    if (this.particles.length > 420) return;   // v11.3 性能保护：粒子上限
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(40, 240);
      this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(size * 0.5, size * 1.4), color, rand(life * 0.6, life * 1.3)));
    }
  }

  explode(x, y, big = false) {
    this.spawnParticles(x, y, big ? 46 : 22, '#ffd24a', big ? 4.5 : 3, big ? 0.8 : 0.5);
    this.spawnParticles(x, y, big ? 30 : 12, '#ff5030', big ? 3.5 : 2.4, big ? 0.7 : 0.45);
    this.spawnParticles(x, y, big ? 20 : 8, '#ffffff', big ? 2.5 : 1.8, 0.3);
    if (big) { this.shake = Math.max(this.shake, 14); SFX.bigExplode(); }
    else { this.shake = Math.max(this.shake, 6); SFX.explode(); }
  }

  /* ---------- 关卡系统 v2.0：常规关 2 个快节奏波；每 5 关一个独立 Boss 关 ---------- */
  nextWave() {
    this.wave++;
    if (this.stage >= 10) this.unlock('stage10');   // v10.0
    this.ui.setStage(this.stage);   // v11.1 关卡常驻显示
    // 常规关最多 2 波，走完自动进入下一关
    if (this.waveInStage > 2) { this.waveInStage = 1; this.stage++; }
    else { this.waveInStage++; }

    this.enemyScale = 1 + (this.stage - 1) * 0.22 + (this.waveInStage - 1) * 0.05;

    if (this.stage % 5 === 0) {
      // Boss 关：独立成关，只有 Boss
      this.bossWarnT = 1.5;
      SFX.bossWarn();
      this.spawnQueue = [{ type: 'boss', t: 1.6 }];
      this.spawnTimer = 0;
      this.ui.showWaveBanner(`第 ${this.stage} 关 · BOSS 关`, true);
      return;
    }

    if (this.waveInStage === 1) {
      this.ui.showWaveBanner(`第 ${this.stage} 关`, false);
      SFX.wave();
    }

    // 中场 Boss 波（v6.0）：stage%5==3 的第 2 波
    if (this.stage % 5 === 3 && this.waveInStage === 2) {
      this.bossWarnT = 1.0;
      SFX.bossWarn();
      this.spawnQueue = [{ type: 'mini', t: 1.0 }];
      this.spawnTimer = 0;
      this.waveTimer = 2.5;
      this.ui.showWaveBanner(`第 ${this.stage} 关 · 中场 Boss`, true);
      return;
    }

    // 事件波（v6.0）：常规第 2 波 28% 概率
    if (this.waveInStage === 2 && this.stage >= 2) {
      const evRoll = Math.random();
      if (evRoll < 0.14) {          // 陨石雨
        const q = [];
        const n = 8 + this.stage;
        for (let i = 0; i < n; i++) q.push({ type: 'meteor', x: rand(30, W - 30), t: 0.4 + i * (2.4 / n) });
        this.spawnQueue = q;
        this.spawnTimer = 0;
        this.waveTimer = 6.0;
        this.ui.showWaveBanner('⚠ 陨石雨', false);
        return;
      } else if (evRoll < 0.28) {   // 蜂群包围
        const q = [];
        for (let i = 0; i < 14; i++) q.push({ type: 'bee', x: 60 + (i % 7) * 60 + rand(-10, 10), t: 0.4 + i * 0.18 });
        this.spawnQueue = q;
        this.spawnTimer = 0;
        this.waveTimer = 6.4;
        this.ui.showWaveBanner('⚠ 蜂群包围', false);
        return;
      }
    }

    // 常规波：按预算生成编队（v2.0 每关 2 波：总量少 1/3，但单波密度/敌速与 v1 持平）
    const budget = 7 + this.stage * 3 + this.waveInStage * 2;
    const q = [];
    let t = 0.4;
    let spent = 0;
    while (spent < budget) {
      const roll = Math.random();
      let type = 'bee', cost = 1;
      if (this.stage >= 3 && this.waveInStage >= 2 && roll < 0.18) { type = 'elite'; cost = 6; }
      else if (this.stage >= 1 && this.waveInStage >= 2 && roll < 0.25) { type = 'wing'; cost = 2; }
      else if (this.stage >= 2 && roll < 0.38) { type = 'kamika'; cost = 2.5; }
      else if (this.stage >= 2 && this.waveInStage >= 2 && roll < 0.5) { type = 'heavy'; cost = 4; }
      // 编队：小蜂 3 连
      if (type === 'bee' && Math.random() < 0.6) {
        const x = rand(50, W - 50);
        for (let i = 0; i < 3; i++) q.push({ type, x, t: t + i * 0.28 });
        spent += cost * 3; t += 0.9;
      } else {
        q.push({ type, x: rand(40, W - 40), t });
        spent += cost; t += rand(0.4, 0.8);
      }
    }
    this.spawnQueue = q;
    this.spawnTimer = 0;
    // 波次限时推进：队列走完 + 1.8 秒缓冲（v2.0 提速）
    this.waveTimer = t + 1.8;
  }

  updateWave(dt) {
    // 生成队列
    if (this.spawnQueue.length) {
      this.spawnTimer += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.spawnTimer) {
        const item = this.spawnQueue.shift();
        if (item.type === 'boss') {
          // 每 5 关一个 Boss，按 Boss 序号（第几个 Boss）取配置与强化
          const bossIdx = Math.max(1, Math.round(this.stage / 5));
          let cfg = BOSS_TYPES[(bossIdx - 1) % BOSS_TYPES.length];
          // 第 25 关：蚀日·真形态（v10.0 终极 Boss）
          if (bossIdx === 5 && this.stage === 25) {
            cfg = { name: '蚀日·真形态 PRIME', color: '#2a0a14', core: '#ff3040', scale: 1.6, hpMul: 3.2, speed: 1.0, fireEvery: 0.85, patterns: ['fan', 'ring', 'spiral', 'rain', 'aimed'], aura: true };
          }
          this.boss = new Boss(cfg, bossIdx);
          this.boss.isPrime = (this.stage === 25);
          this.ui.setBossName(cfg.name);
          this.ui.showBossBar();
        } else if (item.type === 'mini') {
          // 中场 Boss（v6.0）：按 stage 轮换 3 种
          const cfg = MINI_TYPES[Math.floor(this.stage / 5) % MINI_TYPES.length];
          this.miniBoss = new Boss(cfg, Math.max(1, Math.round(this.stage / 5)));
          this.ui.setBossName(cfg.name);
          this.ui.showBossBar();
        } else {
          this.enemies.push(new Enemy(item.type, item.x, -40, this.enemyScale * this.diff.hpMul));
        }
      }
    } else if (!this.boss && !this.miniBoss) {
      // 常规波计时推进
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 && this.enemies.length === 0) this.nextWave();
    }

    if (this.bossWarnT > 0) this.bossWarnT -= dt;
  }

  /* ---------- 必杀（v5.0）：雷霆风暴 ---------- */
  tryUltimate() {
    const p = this.player;
    if (this.state !== 'playing' || p.energy < 100 || this.beam) return false;
    p.energy = 0;
    this.ui.setEnergy(0);
    this.beam = { t: 1.8 };
    p.invul = Math.max(p.invul, 2.2);
    this.shake = Math.max(this.shake, 10);
    SFX.bomb();
    this.ui.floatScore(p.x, p.y - 46, '雷霆风暴！', '#ffe14a');
    this.unlock('beam1');
    return true;
  }

  /* ---------- 击杀与掉落 ---------- */
  onEnemyKilled(enemy) {
    this.kills++;
    // 连击（v10.0）：2 秒窗口内持续击杀
    this.combo++;
    this.comboT = 2;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.maxCombo >= 25) this.unlock('combo25');
    if (this.combo >= 5) this.addScore(this.combo * 2);   // 连击加分
    this.ui.setCombo(this.combo);
    this.addScore(enemy.score);
    this.player.addEnergy(enemy.type === 'elite' ? 12 : 4);   // v5.0
    this.ui.setEnergy(this.player.energy);
    if (enemy.type === 'elite') this.unlock('elite1');
    this.explode(enemy.x, enemy.y, enemy.type === 'heavy');
    this.ui.floatScore(enemy.x, enemy.y, `+${enemy.score}`);

    // 掉落（v8.0：加入 G 磁力/C 暴击芯片，总掉率 49%）
    let kind = null;
    if (enemy.type === 'elite') {
      kind = ['P', 'P', 'W', 'M', 'S', 'B'][irand(0, 5)];
    } else if (enemy.type !== 'meteor') {   // 陨石不掉落（v6.0）
      const roll = Math.random() / this.diff.dropMul;   // v9.0 难度掉率系数
      if (roll < 0.035) kind = 'H';        // 3.5%
      else if (roll < 0.10) kind = 'B';    // 6.5%
      else if (roll < 0.25) kind = 'P';    // 15%
      else if (roll < 0.315) kind = 'S';   // 6.5%
      else if (roll < 0.35) kind = 'W';    // 3.5%
      else if (roll < 0.385) kind = 'M';   // 3.5%
      else if (roll < 0.41) kind = 'V';    // 2.5%
      else if (roll < 0.44) kind = 'O';    // 3%
      else if (roll < 0.465) kind = 'G';   // 2.5%
      else if (roll < 0.49) kind = 'C';    // 2.5%
    }
    if (kind) this.powerups.push(new PowerUp(enemy.x, enemy.y, kind));
  }

  addScore(n) {
    this.score += Math.round(n * this.diff.scoreMul);   // v9.0 难度得分倍率
    this.ui.setScore(this.score);
    if (this.score >= 100000) this.unlock('score100k');
  }

  useBomb() {
    const p = this.player;
    if (p.bombs <= 0 || this.state !== 'playing' || this.bombFlash > 0) return;
    p.bombs--;
    this.ui.setBombs(p.bombs);
    this.bombFlash = 0.9;
    this.bombRing = 0.55;   // v11.3 冲击波圆环
    this.shake = 18;
    SFX.bomb();

    // 清空敌弹 + 全屏伤害
    for (const b of this.bullets) if (b.owner === Bullet.enemy) { this.spawnParticles(b.x, b.y, 2, '#ffc860', 2, 0.3); b.dead = true; }
    for (const e of this.enemies) { e.hp = 0; e.dead = true; this.onEnemyKilled(e); }
    if (this.boss && this.boss.phase > 0) {
      this.boss.hp -= 90;
      if (this.boss.hp <= 0) { this.boss.dead = true; }
    }
    // 玩家短暂无敌
    p.invul = Math.max(p.invul, 1.5);
  }

  /* ---------- 主更新 ---------- */
  update(dt) {
    this.time += dt;
    // 星空永远滚动（标题界面也有动感）
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > H) { s.y = -4; s.x = rand(0, W); }
    }
    // 流星点缀（v11.2，任何界面都有）
    if (this.shoot) {
      const s = this.shoot;
      s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
      if (s.t > s.life || s.y > H + 40) this.shoot = null;
    } else {
      this.shootCd -= dt;
      if (this.shootCd <= 0) {
        this.shootCd = rand(5, 11);
        this.shoot = { x: rand(60, W - 60), y: -20, vx: rand(-90, 90), vy: rand(430, 570), t: 0, life: 1.3 };
      }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40);
    if (this.bombFlash > 0) this.bombFlash -= dt;
    if (this.bombRing > 0) this.bombRing -= dt;   // v11.3
    if (this.comboT > 0) {           // v10.0 连击窗口
      this.comboT -= dt;
      if (this.comboT <= 0) { this.combo = 0; this.ui.setCombo(0); }
    }

    // 粒子与浮字任何时候都更新（爆炸余韵在 gameover 后继续飘）
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(p => !p.dead);
    for (const f of this.floats) f.update(dt);
    this.floats = this.floats.filter(f => !f.dead);

    if (this.state !== 'playing') return;

    this.playT += dt;   // v11.4 仅计游玩时间

    const p = this.player;
    p.update(dt, this.input, this);

    // 玩家子弹（含延迟弹）
    for (const pb of this.pendingBullets) {
      pb.delay -= dt;
      if (pb.delay <= 0) {
        const b = new Bullet(pb.owner, pb.x, pb.y, pb.vx, pb.vy, pb.r, pb.color);
        if (pb.opts) Object.assign(b, pb.opts);
        this.bullets.push(b);
      }
    }
    this.pendingBullets = this.pendingBullets.filter(b => b.delay > 0);
    for (const b of this.bullets) b.update(dt, this);
    this.bullets = this.bullets.filter(b => !b.dead);

    // 敌机
    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter(e => !e.dead);

    // Boss
    if (this.boss) {
      this.boss.update(dt, this);
      this.ui.setBossHp(this.boss.hp / this.boss.maxHp);
      if (this.boss.dead) {
        // —— 关卡通关结算 ——
        const bonus = 500 * this.stage;
        this.addScore(bonus);
        this.bossKills++;
        if (this.bossKills >= 5) this.unlock('boss5');
        if (this.boss.isPrime) { this.addScore(2000); this.unlock('prime'); }   // v10.0
        this.explode(this.boss.x, this.boss.y, true);
        this.explode(this.boss.x - 40, this.boss.y + 20, true);
        this.explode(this.boss.x + 40, this.boss.y - 10, true);
        this.ui.floatScore(this.boss.x, this.boss.y - 20, `通关奖励 +${bonus}`, '#ff7ad9');
        // Boss 必掉护盾 + (炸弹或生命)——v2.0 过 Boss 关武器重置，掉 P 无意义
        this.powerups.push(new PowerUp(this.boss.x - 24, this.boss.y, 'S'));
        this.powerups.push(new PowerUp(this.boss.x + 24, this.boss.y, Math.random() < 0.5 ? 'B' : 'H'));
        this.boss = null;
        this.ui.hideBossBar();
        // v2.0：通过 Boss 关武器重置（v2.1：种类回归火神炮；v4.0：僚机一并清空），生命/护盾/炸弹保留
        if (this.player.power > 1 || this.player.weapon !== 'V' || this.player.drones > 0) {
          this.player.power = 1;
          this.player.weapon = 'V';
          this.player.drones = 0;
          this.player.dr.length = 0;
          this.ui.floatScore(this.player.x, this.player.y - 40, '武器重置！', '#ff9a3c');
          this.ui.setWeapon('V', 1);
        }
        // 进入下一关
        this.stage++;
        this.waveInStage = 0;
        this.waveTimer = 2.2;
        this.ui.setStage(this.stage);   // v11.1 突破横幅期间同步关卡号
        this.ui.showWaveBanner(`第 ${this.stage - 1} 关 突破！`, false, 1600);
        this.spawnQueue = [];
      }
    }

    // 必杀激光：竖向穿透，持续伤害 + 清弹（v5.0）
    if (this.beam) {
      this.beam.t -= dt;
      const bx = p.x;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.x - bx) < 26 + e.r) {
          e.hp -= 60 * dt;
          this.spawnParticles(e.x, e.y, 1, '#ffe14a', 2, 0.25);
          if (e.hp <= 0) { e.dead = true; this.onEnemyKilled(e); }
        }
      }
      if (this.boss && this.boss.phase > 0 && Math.abs(this.boss.x - bx) < 26 + this.boss.r) {
        this.boss.hp -= 45 * dt;
        if (this.boss.hp <= 0) this.boss.dead = true;
      }
      if (this.miniBoss && this.miniBoss.phase > 0 && Math.abs(this.miniBoss.x - bx) < 26 + this.miniBoss.r) {
        this.miniBoss.hp -= 45 * dt;
        if (this.miniBoss.hp <= 0) this.miniBoss.dead = true;
      }
      for (const b of this.bullets) {
        if (b.owner === Bullet.enemy && Math.abs(b.x - bx) < 26) {
          b.dead = true;
          this.spawnParticles(b.x, b.y, 2, '#ffe14a', 2, 0.25);
        }
      }
      if (this.beam.t <= 0) this.beam = null;
    }

    // 中场 Boss（v6.0）
    if (this.miniBoss) {
      this.miniBoss.update(dt, this);
      this.ui.setBossHp(this.miniBoss.hp / this.miniBoss.maxHp);
      if (this.miniBoss.dead) {
        const bonus = 150 * this.stage;
        this.addScore(bonus);
        this.explode(this.miniBoss.x, this.miniBoss.y, true);
        this.ui.floatScore(this.miniBoss.x, this.miniBoss.y - 20, `击破 +${bonus}`, '#ffb04a');
        // 击破必掉：护盾 + 一件武器道具
        this.powerups.push(new PowerUp(this.miniBoss.x - 20, this.miniBoss.y, 'S'));
        this.powerups.push(new PowerUp(this.miniBoss.x + 20, this.miniBoss.y, Math.random() < 0.5 ? 'W' : 'M'));
        this.miniBoss = null;
        this.ui.hideBossBar();
        this.waveTimer = 2.2;
      }
    }

    // 道具
    for (const u of this.powerups) u.update(dt, this);
    this.powerups = this.powerups.filter(u => !u.dead);
    this.ui.updateBuffs(this.player);   // v11.1 增益栏同步（磁力倒计时等）

    this.updateWave(dt);

    /* ---------- 碰撞 ---------- */
    // 玩家子弹 vs 敌机 / Boss
    for (const b of this.bullets) {
      if (b.owner !== Bullet.player) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (hitTest(b, e)) {
          b.dead = true;
          const crit = Math.random() < p.crit;   // v8.0 暴击：双倍伤害
          if (crit) {
            this.ui.floatScore(e.x, e.y - 18, '会心!', '#ff7a7a');
            this.spawnParticles(b.x, b.y, 4, '#ff7a7a', 2.2, 0.3);
          }
          e.onHit(this, crit ? 2 : 1);
          break;
        }
      }
      if (!b.dead && this.boss && this.boss.phase > 0 && hitTest(b, this.boss)) {
        b.dead = true;
        const crit = Math.random() < p.crit;
        if (crit) this.ui.floatScore(this.boss.x + rand(-20, 20), this.boss.y, '会心!', '#ff7a7a');
        if (this.boss.onHit(this, crit ? 2 : 1)) {
          this.boss.dead = true; // 交由上方 Boss 处理块结算
        } else {
          SFX.hitEnemy();
          this.spawnParticles(b.x, b.y, 2, '#ffffff', 1.6, 0.2);
        }
      }
      if (!b.dead && this.miniBoss && this.miniBoss.phase > 0 && hitTest(b, this.miniBoss)) {
        b.dead = true;
        const critM = Math.random() < p.crit;
        if (this.miniBoss.onHit(this, critM ? 2 : 1)) this.miniBoss.dead = true;
        else { SFX.hitEnemy(); this.spawnParticles(b.x, b.y, 2, '#ffffff', 1.6, 0.2); }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);

    // 敌弹 vs 玩家
    for (const b of this.bullets) {
      if (b.owner !== Bullet.enemy) continue;
      if (hitTest(b, p)) {
        b.dead = true;
        if (p.onHit(this)) this.killPlayer();
      }
    }

    // 敌机/ boss 载体 vs 玩家（碰撞体撞击）
    for (const e of this.enemies) {
      if (!e.dead && hitTest(e, p)) {
        e.hp = 0; e.dead = true; this.onEnemyKilled(e);
        if (p.onHit(this)) this.killPlayer();
      }
    }
    if (this.boss && this.boss.phase > 0 && hitTest(this.boss, p)) {
      if (p.onHit(this)) this.killPlayer();
    }
    if (this.miniBoss && this.miniBoss.phase > 0 && hitTest(this.miniBoss, p)) {
      if (p.onHit(this)) this.killPlayer();
    }

    // 道具 vs 玩家（坠机结算后不再拾取）
    for (const u of this.powerups) {
      if (this.state !== 'playing') break;
      if (hitTest(u, p)) {
        u.dead = true;
        SFX.pickup();
        this.applyPowerUp(u.kind);
      }
    }
  }

  applyPowerUp(kind) {
    const p = this.player;
    if (kind === 'P') {
      if (p.power < 5) { p.power++; this.ui.floatScore(p.x, p.y - 34, '火力提升!', '#4aff8a'); }
      else { this.addScore(100); this.ui.floatScore(p.x, p.y - 34, '+100', '#4aff8a'); }
      this.ui.setWeapon(p.weapon, p.power);
    } else if (kind === 'V' || kind === 'W' || kind === 'M') {
      const w = WEAPONS[kind];
      if (p.weapon === kind) {
        if (p.power < 5) { p.power++; this.ui.floatScore(p.x, p.y - 34, `${w.name} 强化!`, w.color); }
        else { this.addScore(100); this.ui.floatScore(p.x, p.y - 34, '+100', w.color); }
      } else {
        p.weapon = kind;
        this.ui.floatScore(p.x, p.y - 34, `切换 ${w.name}!`, w.color);
      }
      this.ui.setWeapon(p.weapon, p.power);
    } else if (kind === 'O') {
      // v4.0 僚机：最多 2 架
      if (p.addDrone()) {
        this.ui.floatScore(p.x, p.y - 34, '僚机加入!', '#7affd4');
        if (p.drones >= 2) this.unlock('drone2');
      }
      else { this.addScore(200); this.ui.floatScore(p.x, p.y - 34, '+200', '#7affd4'); }
    } else if (kind === 'G') {
      // v8.0 磁力芯片
      p.magnetT = 12;
      this.ui.floatScore(p.x, p.y - 34, '磁力吸附!', '#b0ff7a');
    } else if (kind === 'C') {
      // v8.0 暴击芯片（可叠加至 20%）
      p.crit = Math.min(0.20, p.crit + 0.06);
      this.ui.floatScore(p.x, p.y - 34, '暴击芯片!', '#ff7a7a');
    } else if (kind === 'S') {
      p.shield = Math.min(3, p.shield + 1);
      this.ui.floatScore(p.x, p.y - 34, '护盾!', '#4ac8ff');
    } else if (kind === 'B') {
      p.bombs = Math.min(6, p.bombs + 1);
      this.ui.setBombs(p.bombs);
      this.ui.floatScore(p.x, p.y - 34, '炸弹 +1', '#ffc860');
    } else if (kind === 'H') {
      if (p.lives < 5) { p.lives++; this.ui.setLives(p.lives); this.ui.floatScore(p.x, p.y - 34, '生命 +1', '#ff6a9e'); }
      else { this.addScore(200); this.ui.floatScore(p.x, p.y - 34, '+200', '#ff6a9e'); }
    }
  }

  killPlayer() {
    const p = this.player;
    p.lives--;
    this.ui.setLives(Math.max(0, p.lives));
    this.explode(p.x, p.y, true);
    this.flashWhite = 0.35;

    if (p.lives <= 0) {
      p.alive = false;
      this.gameOver();
    } else {
      p.power = Math.max(1, p.power - 1);   // 掉一级火力
      this.ui.setWeapon(p.weapon, p.power);
      if (p.loseDrone()) this.ui.floatScore(p.x, p.y - 58, '僚机损毁', '#ff9a3c');  // v4.0
      this.combo = 0; this.comboT = 0;   // v10.0 坠机断连击
      this.ui.setCombo(0);
      p.x = W / 2; p.y = H - 120;
      p.invul = 2.4;
    }
  }

  /* ---------- 渲染 ---------- */
  render() {
    const g = this.g;
    g.save();

    // 屏幕震动（v11.3：受开关控制）
    if (this.shake > 0 && this.shakeOn) {
      g.translate(rand(-this.shake, this.shake) * 0.5, rand(-this.shake, this.shake) * 0.5);
    }

    // 背景
    g.fillStyle = '#04060f';
    g.fillRect(-20, -20, W + 40, H + 40);

    // 深空渐变
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(20,40,90,.35)');
    bg.addColorStop(0.6, 'rgba(8,16,44,.2)');
    bg.addColorStop(1, 'rgba(40,10,60,.3)');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // 星空
    for (const s of this.stars) {
      g.globalAlpha = s.alpha;
      g.fillStyle = '#cfe9ff';
      g.fillRect(s.x, s.y, s.size, s.size * 2.2);
    }
    g.globalAlpha = 1;

    // 流星（v11.2）
    if (this.shoot) {
      const s = this.shoot;
      const a = Math.max(0, 1 - s.t / s.life) * 0.8;
      g.strokeStyle = `rgba(200,230,255,${a.toFixed(3)})`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - s.vx * 0.09, s.y - s.vy * 0.09);
      g.stroke();
    }

    // Boss 警告
    if (this.bossWarnT > 0) {
      const blink = Math.sin(this.time * 10) > 0;
      if (blink) {
        g.fillStyle = 'rgba(255,40,40,.85)';
        g.font = 'bold 44px "Microsoft YaHei", sans-serif';
        g.textAlign = 'center';
        g.fillText('⚠ BOSS 来袭 ⚠', W / 2, H / 2 - 60);
      }
      g.fillStyle = `rgba(255,40,40,${0.12 * Math.min(1, this.bossWarnT)})`;
      g.fillRect(0, 0, W, H);
    }

    // 实体
    for (const u of this.powerups) u.draw(g, this.time);
    for (const e of this.enemies) e.draw(g);
    if (this.boss) this.boss.draw(g, this.time);
    if (this.player.alive && (this.state === 'playing' || this.state === 'paused')) this.player.draw(g, this.time);
    for (const b of this.bullets) b.draw(g);
    for (const pt of this.particles) pt.draw(g);
    for (const f of this.floats) f.draw(g);

    // 暗角（v11.2，预渲染贴图）
    g.drawImage(this._vignette, 0, 0);

    // 必杀激光（v5.0）
    if (this.beam && this.player.alive) {
      const w = 22 + Math.sin(this.time * 40) * 4;
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(255,240,150,0)');
      grd.addColorStop(0.25, 'rgba(255,225,74,.75)');
      grd.addColorStop(1, 'rgba(255,240,150,.9)');
      g.fillStyle = grd;
      g.shadowColor = '#ffe14a';
      g.shadowBlur = 24;
      g.fillRect(this.player.x - w / 2, 0, w, this.player.y - 20);
      g.shadowBlur = 0;
    }

    // 炸弹冲击波圆环（v11.3）
    if (this.bombRing > 0) {
      const pr = 1 - this.bombRing / 0.55;
      g.strokeStyle = `rgba(255,230,170,${(0.7 * (1 - pr)).toFixed(3)})`;
      g.lineWidth = 6 + pr * 12;
      g.beginPath();
      g.arc(W / 2, H / 2, pr * 540, 0, Math.PI * 2);
      g.stroke();
    }
    // 炸弹白闪
    if (this.bombFlash > 0) {
      g.fillStyle = `rgba(255,240,200,${Math.min(0.75, this.bombFlash * 0.9)})`;
      g.fillRect(-20, -20, W + 40, H + 40);
    }
    // 受击红闪
    if (this.flashWhite > 0) {
      g.fillStyle = `rgba(255,60,60,${Math.min(0.5, this.flashWhite)})`;
      g.fillRect(-20, -20, W + 40, H + 40);
      this.flashWhite -= 1 / 60;
    }

    g.restore();
  }
}
