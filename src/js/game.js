/* game.js —— 游戏核心：主循环 / 波次 / 碰撞 / 渲染 */
'use strict';

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

    this.shake = 0;
    this.flashWhite = 0;
    this.bombFlash = 0;

    this.input = {
      left: false, right: false, up: false, down: false,
      pointerActive: false, px: 0, py: 0,
      bombRequested: false,
    };

    this._initStars();
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
    this.ui.setScore(0);
    this.ui.setLives(this.player.lives);
    this.ui.setBombs(this.player.bombs);
    this.ui.hideBossBar();
  }

  start() {
    this.reset();
    this.state = 'playing';
  }

  pause()  { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }
  toTitle(){ this.state = 'title'; }

  gameOver() {
    this.state = 'gameover';
    SFX.gameover();
    const isBest = this.score > this.best;
    if (isBest) { this.best = this.score; this.ui.saveBest(this.best); }
    this.ui.showGameOver(this.score, this.kills, this.stage, isBest);
  }

  /* ---------- 生成接口 ---------- */
  spawnBullet(owner, x, y, vx, vy, r, color, delay = 0) {
    if (delay > 0) {
      this.pendingBullets.push({ owner, x, y, vx, vy, r, color, delay });
    } else {
      this.bullets.push(new Bullet(owner, x, y, vx, vy, r, color));
    }
  }

  spawnParticles(x, y, n, color, size = 3, life = 0.5) {
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

    // 常规波：按预算生成编队（v2.0 每关 2 波：总量少 1/3，但单波密度/敌速与 v1 持平）
    const budget = 7 + this.stage * 3 + this.waveInStage * 2;
    const q = [];
    let t = 0.4;
    let spent = 0;
    while (spent < budget) {
      const roll = Math.random();
      let type = 'bee', cost = 1;
      if (this.stage >= 1 && this.waveInStage >= 2 && roll < 0.25) { type = 'wing'; cost = 2; }
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
          const cfg = BOSS_TYPES[(bossIdx - 1) % BOSS_TYPES.length];
          this.boss = new Boss(cfg, bossIdx);
          this.ui.setBossName(cfg.name);
          this.ui.showBossBar();
        } else {
          this.enemies.push(new Enemy(item.type, item.x, -40, this.enemyScale));
        }
      }
    } else if (!this.boss) {
      // 常规波计时推进
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 && this.enemies.length === 0) this.nextWave();
    }

    if (this.bossWarnT > 0) this.bossWarnT -= dt;
  }

  /* ---------- 击杀与掉落 ---------- */
  onEnemyKilled(enemy) {
    this.kills++;
    this.addScore(enemy.score);
    this.explode(enemy.x, enemy.y, enemy.type === 'heavy');
    this.ui.floatScore(enemy.x, enemy.y, `+${enemy.score}`);

    // 掉落概率（v2.0.1：P 回调至 18%——Boss 重置火力后需要足够 P 补级）
    const roll = Math.random();
    let kind = null;
    if (roll < 0.045) kind = 'H';
    else if (roll < 0.13) kind = 'B';
    else if (roll < 0.31) kind = 'P';
    else if (roll < 0.39) kind = 'S';
    if (kind) this.powerups.push(new PowerUp(enemy.x, enemy.y, kind));
  }

  addScore(n) {
    this.score += n;
    this.ui.setScore(this.score);
  }

  useBomb() {
    const p = this.player;
    if (p.bombs <= 0 || this.state !== 'playing' || this.bombFlash > 0) return;
    p.bombs--;
    this.ui.setBombs(p.bombs);
    this.bombFlash = 0.9;
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
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40);
    if (this.bombFlash > 0) this.bombFlash -= dt;

    // 粒子与浮字任何时候都更新（爆炸余韵在 gameover 后继续飘）
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(p => !p.dead);
    for (const f of this.floats) f.update(dt);
    this.floats = this.floats.filter(f => !f.dead);

    if (this.state !== 'playing') return;

    const p = this.player;
    p.update(dt, this.input, this);

    // 玩家子弹（含延迟弹）
    for (const pb of this.pendingBullets) {
      pb.delay -= dt;
      if (pb.delay <= 0) this.bullets.push(new Bullet(pb.owner, pb.x, pb.y, pb.vx, pb.vy, pb.r, pb.color));
    }
    this.pendingBullets = this.pendingBullets.filter(b => b.delay > 0);
    for (const b of this.bullets) b.update(dt);
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
        this.explode(this.boss.x, this.boss.y, true);
        this.explode(this.boss.x - 40, this.boss.y + 20, true);
        this.explode(this.boss.x + 40, this.boss.y - 10, true);
        this.ui.floatScore(this.boss.x, this.boss.y - 20, `通关奖励 +${bonus}`, '#ff7ad9');
        // Boss 必掉护盾 + (炸弹或生命)——v2.0 过 Boss 关武器重置，掉 P 无意义
        this.powerups.push(new PowerUp(this.boss.x - 24, this.boss.y, 'S'));
        this.powerups.push(new PowerUp(this.boss.x + 24, this.boss.y, Math.random() < 0.5 ? 'B' : 'H'));
        this.boss = null;
        this.ui.hideBossBar();
        // v2.0：通过 Boss 关，失去获得的武器升级能力（生命/护盾/炸弹保留）
        if (this.player.power > 1) {
          this.player.power = 1;
          this.ui.floatScore(this.player.x, this.player.y - 40, '武器重置！', '#ff9a3c');
        }
        // 进入下一关
        this.stage++;
        this.waveInStage = 0;
        this.waveTimer = 2.2;
        this.ui.showWaveBanner(`第 ${this.stage - 1} 关 突破！`, false, 1600);
        this.spawnQueue = [];
      }
    }

    // 道具
    for (const u of this.powerups) u.update(dt);
    this.powerups = this.powerups.filter(u => !u.dead);

    this.updateWave(dt);

    /* ---------- 碰撞 ---------- */
    // 玩家子弹 vs 敌机 / Boss
    for (const b of this.bullets) {
      if (b.owner !== Bullet.player) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (hitTest(b, e)) {
          b.dead = true;
          e.onHit(this);
          break;
        }
      }
      if (!b.dead && this.boss && this.boss.phase > 0 && hitTest(b, this.boss)) {
        b.dead = true;
        if (this.boss.onHit(this)) {
          this.boss.dead = true; // 交由上方 Boss 处理块结算
        } else {
          SFX.hitEnemy();
          this.spawnParticles(b.x, b.y, 2, '#ffffff', 1.6, 0.2);
        }
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
      p.x = W / 2; p.y = H - 120;
      p.invul = 2.4;
    }
  }

  /* ---------- 渲染 ---------- */
  render() {
    const g = this.g;
    g.save();

    // 屏幕震动
    if (this.shake > 0) {
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
