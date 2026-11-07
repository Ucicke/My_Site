// particles.js — частицы, всплывающий текст, тряска экрана
'use strict';

class Particles {
  constructor(max = 2500) {
    this.list = [];
    this.max = max;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  add(o) {
    const budget=Math.max(0,Math.min(this.max,typeof FX_CONFIG==='undefined'?this.max:FX_CONFIG.maxParticles));
    if(!budget)return null;
    if (this.list.length >= budget) this.list.splice(0,this.list.length-budget+1);
    const p = {
      x: 0, y: 0, vx: 0, vy: 0,
      life: 1, maxLife: 1,
      size: 3, size2: 0,
      color: '#fff', color2: null,
      type: 'circle',
      drag: 0.9, grav: 0,
      rot: 0, spin: 0,
      glow: false,
      text: '', font: 14, stroke: false,
    };
    for (const k in o) p[k] = o[k];
    p.maxLife = p.life;
    this.list.push(p);
    return p;
  }

  burst(x, y, count, opts = {}) {
    const base = {
      x, y,
      speed: 120, spread: TAU, angle: 0,
      life: 0.5, lifeVar: 0.3, size: 3, sizeVar: 2,
      color: '#8ef', color2: '#4a8', grav: 0, drag: 0.9,
      type: 'circle', glow: false, spin: 0,
    };
    const o = Object.assign({}, base, opts);
    for (let i = 0; i < count; i++) {
      const a = o.angle + visualRand(-o.spread / 2, o.spread / 2);
      const sp = visualRand(o.speed * 0.35, o.speed);
      this.add({
        x: o.x, y: o.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: Math.max(0.05, o.life + visualRand(-o.lifeVar, o.lifeVar)),
        size: Math.max(0.5, o.size + visualRand(-o.sizeVar, o.sizeVar)),
        color: o.color2 && visualChance(0.4) ? o.color2 : o.color,
        color2: o.color2,
        type: o.type,
        grav: o.grav,
        drag: o.drag,
        spin: o.spin ? visualRand(-o.spin, o.spin) : 0,
        glow: o.glow,
      });
    }
  }

  text(x, y, str, color = '#fff', size = 15) {
    return this.add({
      x, y, vx: visualRand(-15, 15), vy: -55, life: 0.75, drag: 0.94,
      type: 'text', text: str, color, font: size,
    });
  }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }

    // тряска
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 26);
      const s = this.shake;
      this.shakeX = visualRand(-s, s);
      this.shakeY = visualRand(-s, s);
    } else {
      this.shakeX = 0; this.shakeY = 0;
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.list) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.type === 'text') {
        ctx.font = `bold ${p.font}px "Consolas", monospace`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const s = p.size * (0.4 + a * 0.6);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if(p.type==='droplet') {
        // Small fluid drops use the cheap circle path; direction comes from
        // their actual cosmetic velocity and the baked directional splatter.
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.4,p.size*(.4+a*.6)),0,TAU);ctx.fill();
      } else if (p.type === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else {
        if (p.glow) { ctx.shadowBlur = 12; ctx.shadowColor = p.color; }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, p.size * (0.35 + a * 0.65)), 0, TAU);
        ctx.fill();
        if (p.glow) { ctx.shadowBlur = 0; }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
