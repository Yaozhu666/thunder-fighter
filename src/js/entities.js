/* entities.js —— 实体类：玩家 / 子弹 / 敌机 / Boss / 道具 / 粒子 */
'use strict';

/* ===================== 工具 ===================== */
const W = 480, H = 720;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

/* 圆形碰撞：两实体用 (x,y,r) */
function hitTest(a, b) {
  const r = a.r + b.r;
  return dist2(a.x, a.y, b.x, b.y) <= r * r;
}

/* ===================== 玩家 ===================== */
class Player {
  constructor() {
    this.x = W / 2; this.y = H - 120;
    this.r = 10;              // 碰撞半径（判定小于视觉，符合射击游戏惯例）
    this.speed = 340;
    this.lives = 3;
    this.bombs = 2;
    this.power = 1;           // 火力等级 1~5
    this.shield = 0;          // 护盾剩余次数
    this.invul = 0;           // 无敌剩余秒数
    this.fireCd = 0;          // 开火冷却
    this.alive = true;
    this.tilt = 0;            // 左右倾斜角（视觉）
  }

  update(dt, input, game) {
    const sp = this.speed * dt;
    let vx = 0, vy = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;

    // 鼠标/触摸跟随：直接朝目标点移动
    if (input.pointerActive) {
      const dx = input.px - this.x, dy = input.py - (this.y - 26);
      this.x += clamp(dx, -sp * 1.6, sp * 1.6);
      this.y += clamp(dy, -sp * 1.6, sp * 1.6);
      this.tilt = clamp(dx * 0.02, -0.5, 0.5);
    } else {
      if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
      this.x += vx * sp; this.y += vy * sp;
      this.tilt += ((vx * 0.35) - this.tilt) * Math.min(1, dt * 12);
    }
    this.x = clamp(this.x, 18, W - 18);
    this.y = clamp(this.y, 40, H - 30);

    if (this.invul > 0) this.invul -= dt;

    // 自动开火
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fire(game);
      this.fireCd = 0.16 - Math.min(0.06, (this.power - 1) * 0.015);
    }
  }

  fire(game) {
    const B = Bullet.player;
    const x = this.x, y = this.y - 24;
    const lv = this.power;
    if (lv === 1)      game.spawnBullet(B, x, y, 0, -620, 3.2, '#9ff7ff');
    else if (lv === 2) { game.spawnBullet(B, x - 9, y, 0, -620, 3.2, '#9ff7ff');
                         game.spawnBullet(B, x + 9, y, 0, -620, 3.2, '#9ff7ff'); }
    else if (lv === 3) { game.spawnBullet(B, x, y - 6, 0, -660, 3.6, '#dfffff');
                         game.spawnBullet(B, x - 12, y + 4, -70, -600, 3.2, '#9ff7ff');
                         game.spawnBullet(B, x + 12, y + 4, 70, -600, 3.2, '#9ff7ff'); }
    else if (lv === 4) { game.spawnBullet(B, x - 6, y, 0, -680, 3.8, '#dfffff');
                         game.spawnBullet(B, x + 6, y, 0, -680, 3.8, '#dfffff');
                         game.spawnBullet(B, x - 15, y + 6, -110, -580, 3.2, '#9ff7ff');
                         game.spawnBullet(B, x + 15, y + 6, 110, -580, 3.2, '#9ff7ff'); }
    else {               game.spawnBullet(B, x, y - 8, 0, -700, 4.2, '#ffffff');
                         game.spawnBullet(B, x - 8, y, -40, -680, 3.8, '#dfffff');
                         game.spawnBullet(B, x + 8, y, 40, -680, 3.8, '#dfffff');
                         game.spawnBullet(B, x - 18, y + 8, -150, -560, 3.2, '#9ff7ff');
                         game.spawnBullet(B, x + 18, y + 8, 150, -560, 3.2, '#9ff7ff');
                         game.spawnBullet(B, x - 24, y + 12, -230, -520, 3, '#6ef3ff');
                         game.spawnBullet(B, x + 24, y + 12, 230, -520, 3, '#6ef3ff'); }
    SFX.shoot();
  }

  onHit(game) {
    if (this.invul > 0) return false;
    if (this.shield > 0) {
      this.shield--;
      this.invul = 1.2;
      game.spawnParticles(this.x, this.y, 18, '#6ef3ff', 3.5);
      SFX.hitEnemy();
      return false;
    }
    return true; // 真正被击中
  }

  draw(g, time) {
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.tilt);

    // 无敌闪烁
    if (this.invul > 0 && Math.floor(time * 20) % 2 === 0) g.globalAlpha = 0.35;

    // 尾焰
    const flame = 12 + Math.sin(time * 40) * 4;
    const fg = g.createLinearGradient(0, 18, 0, 18 + flame + 10);
    fg.addColorStop(0, 'rgba(120,220,255,.95)');
    fg.addColorStop(0.5, 'rgba(60,140,255,.5)');
    fg.addColorStop(1, 'rgba(60,140,255,0)');
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(-5, 16); g.lineTo(5, 16); g.lineTo(0, 18 + flame); g.closePath();
    g.fill();

    // 机身
    g.fillStyle = '#e8f6ff';
    g.beginPath();
    g.moveTo(0, -26);           // 机头
    g.lineTo(6, -8);
    g.lineTo(22, 6);            // 右翼
    g.lineTo(22, 12);
    g.lineTo(8, 10);
    g.lineTo(6, 18);            // 右尾
    g.lineTo(-6, 18);
    g.lineTo(-8, 10);
    g.lineTo(-22, 12);          // 左翼
    g.lineTo(-22, 6);
    g.lineTo(-6, -8);
    g.closePath();
    g.fill();

    // 蓝色涂装
    g.fillStyle = '#1d9cd8';
    g.beginPath();
    g.moveTo(0, -20); g.lineTo(4, -4); g.lineTo(-4, -4); g.closePath();
    g.fill();
    g.fillRect(-14, 7, 28, 3);

    // 座舱
    g.fillStyle = '#0a2a5a';
    g.beginPath();
    g.ellipse(0, -8, 3.2, 6, 0, 0, Math.PI * 2);
    g.fill();

    // 护盾
    if (this.shield > 0) {
      g.strokeStyle = `rgba(110,243,255,${0.5 + Math.sin(time * 6) * 0.3})`;
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, 30, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
}

/* ===================== 子弹 ===================== */
class Bullet {
  constructor(owner, x, y, vx, vy, r, color) {
    this.owner = owner;       // 'player' | 'enemy'
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = r;
    this.color = color;
    this.dead = false;
    this.homing = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -30 || this.x > W + 30 || this.y < -30 || this.y > H + 30) this.dead = true;
  }
  draw(g) {
    g.fillStyle = this.color;
    g.shadowColor = this.color;
    g.shadowBlur = 6;
    if (this.owner === 'player') {
      g.fillRect(this.x - 1.6, this.y - this.r * 2.2, 3.2, this.r * 4.4);
    } else {
      g.beginPath();
      g.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath();
      g.arc(this.x, this.y, this.r * 0.45, 0, Math.PI * 2);
      g.fill();
    }
    g.shadowBlur = 0;
  }
}
Bullet.player = 'player';
Bullet.enemy = 'enemy';

/* ===================== 敌机 ===================== */
/* 类型表：小蜂 / 侧翼机 / 自爆机 / 重炮机 */
const ENEMY_TYPES = {
  bee:    { hp: 2,  score: 10, r: 12, color: '#ff6a6a', fire: 4.8,   body: 'bee' },
  wing:   { hp: 3,  score: 20, r: 14, color: '#ff9a3c', fire: 2.0,   body: 'wing' },
  kamika: { hp: 4,  score: 30, r: 12, color: '#ff3c9e', fire: 0,     body: 'kamika' },
  heavy:  { hp: 9,  score: 60, r: 22, color: '#b06aff', fire: 1.6,   body: 'heavy' },
};

class Enemy {
  constructor(type, x, y, waveScale) {
    const t = ENEMY_TYPES[type];
    this.type = type;
    this.x = x; this.y = y;
    this.r = t.r;
    this.hp = Math.ceil(t.hp * waveScale);
    this.maxHp = this.hp;
    this.score = t.score;
    this.color = t.color;
    this.body = t.body;
    this.dead = false;
    this.fireTimer = rand(0.8, 2.2);
    this.fireEvery = t.fire;
    this.t = 0;                       // 存活时间
    this.baseX = x;
    this.targetX = x;
    this.flash = 0;

    if (this.type === 'bee') {
      this.vy = rand(150, 210) * Math.min(1.6, waveScale);
      this.amp = rand(30, 70);
      this.freq = rand(2, 4);
    } else if (type === 'wing') {
      this.vy = rand(90, 130) * Math.min(1.5, waveScale);
      this.vx = x < W / 2 ? rand(30, 70) : -rand(30, 70);
    } else if (type === 'kamika') {
      this.vy = 60;
    } else { // heavy
      this.vy = rand(46, 64);
      this.vx = 0;
    }
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;

    if (this.type === 'bee') {
      this.y += this.vy * dt;
      this.x = this.baseX + Math.sin(this.t * this.freq) * this.amp;
    } else if (this.type === 'wing') {
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.x < 20 || this.x > W - 20) this.vx *= -1;
    } else if (this.type === 'kamika') {
      // 追踪玩家，越追越快
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(640, 200 + this.t * 260);
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
      if (Math.random() < dt * 8) game.spawnParticles(this.x, this.y, 1, '#ff3c9e', 1.2, 0.3);
    } else { // heavy：缓慢下压，水平往返
      this.y += this.vy * dt;
      this.x = this.baseX + Math.sin(this.t * 0.9) * 90;
    }
    this.x = clamp(this.x, 16, W - 16);

    // 开火
    if (this.fireEvery > 0) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && this.y > 0 && this.y < H - 120) {
        this.fire(game);
        this.fireTimer = this.fireEvery * rand(0.85, 1.2);
      }
    }
    if (this.y > H + 40) this.dead = true;
  }

  fire(game) {
    const p = game.player;
    const E = Bullet.enemy;
    if (this.type === 'bee' || this.type === 'wing') {
      // 瞄准弹 2 连发（第二发延迟）
      this.aimShot(game, p, 300, 3.6, 0);
      this.aimShot(game, p, 300, 3.6, 0.15);
    } else if (this.type === 'heavy') {
      // 5 发扇形
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 0.22;
        game.spawnBullet(E, this.x, this.y + 10, Math.cos(a) * 265, Math.sin(a) * 265, 4.5, '#ff7ad9');
      }
    }
    SFX.enemyShoot();
  }

  aimShot(game, p, sp, r, delay = 0) {
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    game.spawnBullet(Bullet.enemy, this.x, this.y + 8, dx / d * sp, dy / d * sp, r, '#ffb04a', delay);
  }

  onHit(game) {
    this.hp--;
    this.flash = 0.08;
    if (this.hp <= 0) {
      this.dead = true;
      game.onEnemyKilled(this);
      return true;
    }
    SFX.hitEnemy();
    game.spawnParticles(this.x, this.y, 3, '#ffffff', 2, 0.25);
    return false;
  }

  draw(g) {
    g.save();
    g.translate(this.x, this.y);
    const col = this.flash > 0 ? '#ffffff' : this.color;

    if (this.body === 'bee') {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 14);
      g.lineTo(-12, -8); g.lineTo(-5, -12); g.lineTo(0, -6);
      g.lineTo(5, -12); g.lineTo(12, -8);
      g.closePath(); g.fill();
      g.fillStyle = '#5a1020';
      g.beginPath(); g.arc(0, 0, 3.5, 0, Math.PI * 2); g.fill();
    } else if (this.body === 'wing') {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 16);
      g.lineTo(-16, 2); g.lineTo(-10, -10); g.lineTo(0, -4);
      g.lineTo(10, -10); g.lineTo(16, 2);
      g.closePath(); g.fill();
      g.fillStyle = '#5a2a00';
      g.fillRect(-3, -2, 6, 10);
    } else if (this.body === 'kamika') {
      g.rotate(Math.PI); // 机头朝下（冲向玩家）
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 16);
      g.lineTo(-8, -4); g.lineTo(-3, -12); g.lineTo(3, -12); g.lineTo(8, -4);
      g.closePath(); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 2, 3 + Math.sin(this.t * 30) * 1.2, 0, Math.PI * 2); g.fill();
    } else { // heavy
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 24);
      g.lineTo(-22, 10); g.lineTo(-24, -10); g.lineTo(-10, -18);
      g.lineTo(10, -18); g.lineTo(24, -10); g.lineTo(22, 10);
      g.closePath(); g.fill();
      g.fillStyle = '#2a1040';
      g.beginPath(); g.arc(0, 2, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff7ad9';
      g.beginPath(); g.arc(0, 2, 3.5, 0, Math.PI * 2); g.fill();
      // 血条（重炮机）
      if (this.hp < this.maxHp) {
        g.fillStyle = '#3a1030';
        g.fillRect(-18, -24, 36, 4);
        g.fillStyle = '#ff4040';
        g.fillRect(-18, -24, 36 * this.hp / this.maxHp, 4);
      }
    }
    g.restore();
  }
}

/* ===================== Boss ===================== */
/* 8 种关底 Boss，按关卡循环并逐关强化 */
const BOSS_TYPES = [
  { name: '无畏级 DREADNOUGHT', color: '#8a2be2', core: '#ff7ad9', scale: 1.00, hpMul: 1.0, speed: 0.70, fireEvery: 1.15, patterns: ['fan', 'ring', 'aimed'] },
  { name: '迅猛号 RAPTOR',      color: '#e23b3b', core: '#ffb04a', scale: 0.85, hpMul: 0.8, speed: 1.50, fireEvery: 0.85, patterns: ['aimed', 'fan', 'aimed'] },
  { name: '九头蛇 HYDRA',       color: '#3bd46a', core: '#aaff7a', scale: 1.05, hpMul: 1.1, speed: 0.80, fireEvery: 1.30, patterns: ['spiral', 'fan', 'spiral'] },
  { name: '移动要塞 FORTRESS',  color: '#e2883b', core: '#ffd24a', scale: 1.25, hpMul: 1.5, speed: 0.45, fireEvery: 1.60, patterns: ['ring', 'rain', 'fan'] },
  { name: '幻影 PHANTOM',       color: '#3bd4c8', core: '#b0ffff', scale: 0.80, hpMul: 0.9, speed: 2.00, fireEvery: 0.75, patterns: ['aimed', 'rain', 'aimed'] },
  { name: '泰坦 TITAN',         color: '#d4b13b', core: '#fff0a0', scale: 1.45, hpMul: 2.0, speed: 0.40, fireEvery: 1.50, patterns: ['ring', 'fan', 'spiral'] },
  { name: '漩涡 VORTEX',        color: '#3b6ae2', core: '#7ab0ff', scale: 1.00, hpMul: 1.3, speed: 0.90, fireEvery: 1.00, patterns: ['spiral', 'ring', 'spiral'] },
  { name: '蚀日 ECLIPSE',       color: '#45202e', core: '#ff3040', scale: 1.30, hpMul: 2.4, speed: 1.10, fireEvery: 0.95, patterns: ['fan', 'ring', 'spiral', 'aimed'], aura: true },
];

class Boss {
  constructor(cfg, level) {
    this.cfg = cfg;
    this.level = level;
    this.x = W / 2; this.y = -120;
    this.r = 46 * cfg.scale;
    const hp = Math.round((300 + level * 100) * cfg.hpMul);
    this.hp = hp; this.maxHp = hp;
    this.phase = 0;          // 0 进场, 1 战斗
    this.dead = false;
    this.t = 0;
    this.fireCd = 2;
    this.patternIdx = 0;
    this.spiralA = Math.random() * Math.PI * 2;
    this.flash = 0;
    // 关卡强化系数
    this.bSpeed = 1 + Math.min(0.6, (level - 1) * 0.07);
    this.cdMul = Math.max(0.55, 1 - (level - 1) * 0.05);
  }

  get enraged() { return this.hp < this.maxHp * 0.35; }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;

    if (this.phase === 0) {           // 进场
      this.y += 130 * dt;
      if (this.y >= 110) { this.y = 110; this.phase = 1; }
      return;
    }

    if (this.enraged && !this._wasEnraged) {
      this._wasEnraged = true;
      game.spawnParticles(this.x, this.y, 30, '#ff5050', 4, 0.6);
      SFX.bossWarn();
    }

    // 水平巡航（速度型 Boss 移动更快）
    const sw = this.cfg.speed * (this.enraged ? 1.6 : 1.0);
    this.x = W / 2 + Math.sin(this.t * 0.7 * sw) * (W / 2 - 90);

    this.fireCd -= dt;
    if (this.fireCd <= 0) this.fire(game);
  }

  fire(game) {
    const key = this.cfg.patterns[this.patternIdx % this.cfg.patterns.length];
    this.patternIdx++;
    const p = game.player;
    const E = Bullet.enemy;
    const sp = this.bSpeed;
    const n = this.enraged;           // 狂暴加量

    if (key === 'fan') {              // 瞄准扇形
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const cnt = n ? 11 : 9;
      for (let i = 0; i < cnt; i++) {
        const a = ang + (i - (cnt - 1) / 2) * 0.17;
        game.spawnBullet(E, this.x, this.y + 30, Math.cos(a) * 270 * sp, Math.sin(a) * 270 * sp, 4.6, '#ff5a5a');
      }
    } else if (key === 'ring') {      // 全周环形
      const cnt = n ? 26 : 18;
      const off = Math.random() * Math.PI;
      for (let i = 0; i < cnt; i++) {
        const a = off + i / cnt * Math.PI * 2;
        game.spawnBullet(E, this.x, this.y, Math.cos(a) * 210 * sp, Math.sin(a) * 210 * sp, 4.2, '#ffa04a');
      }
    } else if (key === 'aimed') {     // 瞄准三连（延迟弹）
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 3; i++) {
        const s = 340 * sp - i * 45;
        game.spawnBullet(E, this.x, this.y + 30, dx / d * s, dy / d * s, 5, '#ff5ad9', i * 0.14);
      }
    } else if (key === 'spiral') {    // 双臂螺旋
      const arms = 3;
      for (let i = 0; i < arms; i++) {
        const a = this.spiralA + i / arms * Math.PI * 2;
        game.spawnBullet(E, this.x, this.y, Math.cos(a) * 195 * sp, Math.sin(a) * 195 * sp, 4.0, '#7ab0ff');
      }
      this.spiralA += 0.42;
      // 螺旋是连发：短时间内多次触发
      this.fireCd = 0.14;
      this.spiralBurst = (this.spiralBurst || 0) + 1;
      if (this.spiralBurst >= (n ? 22 : 16)) { this.spiralBurst = 0; this.fireCd = this.cfg.fireEvery * this.cdMul * 1.4; }
      SFX.enemyShoot();
      return;
    } else if (key === 'rain') {      // 随机弹雨
      const cnt = n ? 12 : 9;
      for (let i = 0; i < cnt; i++) {
        const a = Math.PI / 2 + rand(-0.55, 0.55);
        game.spawnBullet(E, this.x + rand(-50, 50) * this.cfg.scale, this.y + 24, Math.cos(a) * 250 * sp, Math.sin(a) * 250 * sp, 3.8, '#ff8a5a');
      }
    }

    this.fireCd = this.cfg.fireEvery * this.cdMul * (n ? 0.8 : 1) * rand(0.9, 1.1);
    SFX.enemyShoot();
  }

  onHit(game) {
    this.hp--;
    this.flash = 0.05;
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }

  draw(g, time) {
    g.save();
    g.translate(this.x, this.y);
    g.scale(this.cfg.scale, this.cfg.scale);
    const col = this.flash > 0 ? '#ffffff' : this.cfg.color;

    // 蚀日光环
    if (this.cfg.aura) {
      g.strokeStyle = `rgba(255,48,64,${0.35 + Math.sin(time * 4) * 0.2})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, 62, 0, Math.PI * 2);
      g.stroke();
    }

    // 巨型母舰
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 44);
    g.lineTo(-34, 30); g.lineTo(-58, 4); g.lineTo(-46, -22);
    g.lineTo(-18, -34); g.lineTo(18, -34); g.lineTo(46, -22);
    g.lineTo(58, 4); g.lineTo(34, 30);
    g.closePath(); g.fill();

    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath();
    g.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
    g.fill();

    // 核心发光
    const pulse = 8 + Math.sin(time * 6) * 2.5;
    g.fillStyle = this.enraged ? '#ff3030' : this.cfg.core;
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 18;
    g.beginPath(); g.arc(0, 6, pulse, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;

    // 两侧炮塔
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.fillRect(-44, 8, 12, 16);
    g.fillRect(32, 8, 12, 16);

    // 尾部推进光
    g.fillStyle = `rgba(255,160,74,${0.5 + Math.sin(time * 18) * 0.3})`;
    g.fillRect(-12, -40, 8, 8);
    g.fillRect(4, -40, 8, 8);

    g.restore();
  }
}

/* ===================== 道具 ===================== */
const POWERUP_KINDS = ['P', 'S', 'B', 'H'];

class PowerUp {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;
    this.r = 12;
    this.vy = 90;
    this.dead = false;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.x += Math.sin(this.t * 2.5) * 26 * dt;
    if (this.y > H + 30) this.dead = true;
  }
  draw(g, time) {
    const colors = { P: '#4aff8a', S: '#4ac8ff', B: '#ffc860', H: '#ff6a9e' };
    const c = colors[this.kind];
    g.save();
    g.translate(this.x, this.y);
    g.rotate(Math.sin(time * 3) * 0.2);
    g.shadowColor = c; g.shadowBlur = 12;
    g.fillStyle = '#0a1428';
    g.beginPath();
    const r = 13;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 - Math.PI / 2;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.strokeStyle = c; g.lineWidth = 2; g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = c;
    g.font = 'bold 13px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(this.kind, 0, 1);
    g.restore();
  }
}

/* ===================== 粒子 ===================== */
class Particle {
  constructor(x, y, vx, vy, size, color, life) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = size;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.96; this.vy *= 0.96;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(g) {
    const a = Math.max(0, this.life / this.maxLife);
    g.globalAlpha = a;
    g.fillStyle = this.color;
    g.beginPath();
    g.arc(this.x, this.y, this.size * (0.4 + a * 0.6), 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
}

/* ===================== 浮动得分文字 ===================== */
class FloatText {
  constructor(x, y, text, color = '#ffc860') {
    this.x = x; this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0.8;
    this.maxLife = 0.8;
    this.dead = false;
  }
  update(dt) {
    this.y -= 44 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(g) {
    g.globalAlpha = Math.max(0, this.life / this.maxLife);
    g.fillStyle = this.color;
    g.font = 'bold 15px monospace';
    g.textAlign = 'center';
    g.fillText(this.text, this.x, this.y);
    g.globalAlpha = 1;
  }
}
