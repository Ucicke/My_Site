// level.js — мир, препятствия, фон
'use strict';

class Level {
  constructor(w = 2200, h = 1600, seed = 1337) {
    this.seed = seed;
    this.w = w;
    this.h = h;
    this.obstacles = [];
    this.decor = [];
    this.generate();
  }

  generate() {
    const rng = mulberry32(this.seed);
    // камни (препятствия)
    for (let i = 0; i < 22; i++) {
      const r = 26 + rng() * 46;
      const x = 120 + rng() * (this.w - 240);
      const y = 120 + rng() * (this.h - 240);
      // не ставим камни в самом центре (там спавн игрока)
      if (dist(x, y, this.w / 2, this.h / 2) < 260) continue;
      this.obstacles.push({ x, y, r, type: 'rock', seed: rng() * 100 });
    }
    // кусты, трава, земляные пятна и камешки (фон)
    for (let i = 0; i < 620; i++) {
      const x = rng() * this.w;
      const y = rng() * this.h;
      const roll = rng();
      const type = roll < 0.42 ? 'grass' : roll < 0.62 ? 'dirt' : roll < 0.8 ? 'pebble' : 'bush';
      this.decor.push({
        x, y,
        r: type === 'grass' ? 10 + rng() * 16 : type === 'pebble' ? 2 + rng() * 4 : 16 + rng() * 40,
        h: rng(),
        type,
        seed: rng() * 100,
      });
    }
  }

  drawGround(ctx, view) {
    const texture=typeof getSprite==='function'&&getSprite('organic_ground');
    if(texture){
      // A repeated CanvasPattern caused the Canvas backend to stall after a few
      // seconds in Chrome. Draw the same world-anchored PNG as visible tiles.
      const tileW=texture.naturalWidth*.62,tileH=texture.naturalHeight*.62;
      ctx.save();ctx.beginPath();ctx.rect(view.x0,view.y0,view.x1-view.x0,view.y1-view.y0);ctx.clip();
      for(let y=Math.floor(view.y0/tileH)*tileH;y<view.y1;y+=tileH){
        for(let x=Math.floor(view.x0/tileW)*tileW;x<view.x1;x+=tileW)ctx.drawImage(texture,x,y,tileW,tileH);
      }
      ctx.restore();ctx.fillStyle='rgba(4,14,6,.38)';ctx.fillRect(view.x0,view.y0,view.x1-view.x0,view.y1-view.y0);return;
    }
    // земля
    ctx.fillStyle = '#1a2412';
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

    // пятна почвы
    for (const d of this.decor) {
      if (d.x < view.x0 - 80 || d.x > view.x1 + 80 || d.y < view.y0 - 80 || d.y > view.y1 + 80) continue;
      if (d.type === 'grass') {
        ctx.strokeStyle = `rgba(104,148,70,${0.3 + d.h * 0.35})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = d.seed + i * 1.3;
          const bx = d.x + Math.cos(a) * (i * 2.5);
          const by = d.y + Math.sin(a) * (i * 2.5);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a * 2) * 7, by + Math.sin(a * 2) * 7 - 4);
        }
        ctx.stroke();
      } else if (d.type === 'dirt') {
        ctx.fillStyle = `rgba(58,44,26,${0.18 + d.h * 0.22})`;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r * 0.95, d.r * 0.55, d.seed, 0, TAU);
        ctx.fill();
      } else if (d.type === 'pebble') {
        ctx.fillStyle = `rgba(130,130,110,${0.25 + d.h * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r, d.r * 0.75, d.seed, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(26,48,20,${0.5 + d.h * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, d.seed, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawObstacles(ctx, view) {
    for (const o of this.obstacles) {
      if (o.x < view.x0 - 120 || o.x > view.x1 + 120 || o.y < view.y0 - 120 || o.y > view.y1 + 120) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      // тень
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(4, o.r * 0.55, o.r * 0.95, o.r * 0.4, 0, 0, TAU);
      ctx.fill();
      const rock=typeof getSprite==='function'&&getSprite('organic_rock');
      if(rock){ctx.rotate(o.seed);ctx.drawImage(rock,-o.r*1.12,-o.r*1.12,o.r*2.24,o.r*2.24);ctx.restore();continue;}
      // камень
      const g = ctx.createRadialGradient(-o.r * 0.3, -o.r * 0.4, o.r * 0.1, 0, 0, o.r);
      g.addColorStop(0, '#6b6f5e');
      g.addColorStop(1, '#33382c');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * TAU;
        const rr = o.r * (0.85 + Math.sin(a * 3 + o.seed) * 0.15);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // мох
      ctx.fillStyle = 'rgba(80,140,60,0.35)';
      ctx.beginPath();
      ctx.ellipse(-o.r * 0.2, -o.r * 0.35, o.r * 0.45, o.r * 0.25, o.seed, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // граница арены — густые заросли
  drawBorder(ctx) {
    const t = 60;
    ctx.fillStyle = '#0d1a0c';
    // верх
    ctx.fillRect(-200, -200, this.w + 400, t);
    // низ
    ctx.fillRect(-200, this.h - t + 200, this.w + 400, t + 200);
    // лево
    ctx.fillRect(-200, -200, t, this.h + 400);
    // право
    ctx.fillRect(this.w - t + 200, -200, t, this.h + 400);

    // зубчатая кромка
    ctx.fillStyle = '#132613';
    ctx.beginPath();
    for (let x = -200; x < this.w + 200; x += 26) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 13, 22 + Math.sin(x * 0.05) * 10);
      ctx.lineTo(x + 26, 0);
    }
    for (let x = -200; x < this.w + 200; x += 26) {
      ctx.moveTo(x, this.h);
      ctx.lineTo(x + 13, this.h - 22 - Math.sin(x * 0.05) * 10);
      ctx.lineTo(x + 26, this.h);
    }
    for (let y = -200; y < this.h + 200; y += 26) {
      ctx.moveTo(0, y);
      ctx.lineTo(22 + Math.sin(y * 0.05) * 10, y + 13);
      ctx.lineTo(0, y + 26);
    }
    for (let y = -200; y < this.h + 200; y += 26) {
      ctx.moveTo(this.w, y);
      ctx.lineTo(this.w - 22 - Math.sin(y * 0.05) * 10, y + 13);
      ctx.lineTo(this.w, y + 26);
    }
    ctx.fill();
  }
}

let LEVEL = null;

// детерминированный ГПСЧ
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// перемещение сущности с трением и столкновениями с камнями
function moveAndCollide(o, dt, radius) {
  o.x += o.vx * dt;
  o.y += o.vy * dt;

  const fr = Math.pow(0.9, dt * 60);
  o.vx *= fr;
  o.vy *= fr;

  if (!LEVEL) return;
  for (const ob of LEVEL.obstacles) {
    const dx = o.x - ob.x, dy = o.y - ob.y;
    const rr = ob.r + radius;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const push = rr - d;
      o.x += nx * push;
      o.y += ny * push;
      const vn = o.vx * nx + o.vy * ny;
      if (vn < 0) {
        o.vx -= nx * vn * 1.5;
        o.vy -= ny * vn * 1.5;
      }
    }
  }
}
