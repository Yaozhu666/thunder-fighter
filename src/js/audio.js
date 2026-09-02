/* audio.js —— WebAudio 合成音效引擎（无外部资源） */
'use strict';

const SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('th_mute') === '1'; } catch (e) {}   // v11.0 静音持久化

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* 基础振荡音：type 波形, f0->f1 频率滑变, dur 时长, vol 音量, delay 延迟 */
  function tone(type, f0, f1, dur, vol, delay = 0) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* 噪声爆裂：dur 时长, vol 音量, filterHz 滤波截止 */
  function noise(dur, vol, filterHz, sweepTo = 0) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterHz, t);
    if (sweepTo > 0) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('th_mute', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    get muted() { return muted; },

    shoot()      { tone('square', 880, 320, 0.07, 0.05); },
    enemyShoot() { tone('sawtooth', 260, 140, 0.09, 0.035); },
    hitEnemy()   { tone('triangle', 1400, 700, 0.05, 0.05); },
    explode()    { noise(0.4, 0.5, 2400, 120); tone('sawtooth', 160, 40, 0.35, 0.22); },
    bigExplode() { noise(0.9, 0.7, 3200, 60); tone('sawtooth', 120, 30, 0.7, 0.3); tone('sine', 60, 24, 0.8, 0.3); },
    playerHit()  { noise(0.5, 0.55, 1800, 100); tone('square', 300, 60, 0.4, 0.25); },
    pickup()     { tone('sine', 520, 1040, 0.12, 0.22); tone('sine', 780, 1560, 0.14, 0.15, 0.06); },
    bomb()       { noise(1.2, 0.8, 5000, 40); tone('sine', 220, 20, 1.1, 0.4); },
    bossWarn()   { tone('square', 220, 220, 0.28, 0.2); tone('square', 174, 174, 0.28, 0.2, 0.34); },
    gameover()   { tone('sawtooth', 440, 110, 0.8, 0.25); tone('sawtooth', 330, 82, 0.9, 0.2, 0.15); },
    wave()       { tone('square', 523, 784, 0.16, 0.14); tone('square', 784, 1046, 0.18, 0.12, 0.14); },
  };
})();
