/* ================================================================
   SCROLL HUNTER · engine/effects.js — частицы, текст, тряска, вспышка
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   4. Частицы, всплывающий текст, тряска, вспышка
--------------------------------------------------------------- */
const particles = [];
const floaters = [];
const shake = { time: 0, dur: 1, mag: 0 };
const flash = { time: 0, dur: 1, color: '#ffffff' };

function addParticle(p) {
    particles.push(p);
}

function burstScroll(x, y) {
    for (let i = 0; i < 46; i++) {
        const a = randIn('visual', 0, TAU);
        const s = randIn('visual', 1.2, 6);
        addParticle({
            x: x + randIn('visual', -30, 30), y: y + randIn('visual', -16, 16),
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.6,
            size: randIn('visual', 2, 5), color: `hsl(${randIntIn('visual', 38, 56)}, 100%, ${randIntIn('visual', 58, 78)}%)`,
            life: randIn('visual', 0.6, 1.2), max: 1.2, grav: 0.06, glow: true
        });
    }
    for (let i = 0; i < 14; i++) {
        const a = randIn('visual', 0, TAU);
        addParticle({
            x: x, y: y, vx: Math.cos(a) * randIn('visual', 0.5, 2.4), vy: Math.sin(a) * randIn('visual', 0.5, 2.4),
            size: randIn('visual', 3, 7), color: 'rgba(255,240,190,0.55)',
            life: randIn('visual', 0.5, 1), max: 1, grav: -0.02, soft: true
        });
    }
}

function burstMimic(x, y) {
    for (let i = 0; i < 54; i++) {
        const a = randIn('visual', 0, TAU);
        const s = randIn('visual', 2, 8);
        addParticle({
            x: x, y: y,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - randIn('visual', 1, 3),
            size: randIn('visual', 2, 6), color: GameRng.next('visual') > 0.35 ? `hsl(${randIntIn('visual', 0, 18)}, 100%, ${randIntIn('visual', 45, 60)}%)` : '#2a0d08',
            life: randIn('visual', 0.5, 1.1), max: 1.1, grav: 0.14
        });
    }
    for (let i = 0; i < 18; i++) {
        addParticle({
            x: x + randIn('visual', -20, 20), y: y + randIn('visual', -10, 10),
            vx: randIn('visual', -0.8, 0.8), vy: randIn('visual', -1.6, -0.4),
            size: randIn('visual', 8, 18), color: 'rgba(60,10,10,0.42)',
            life: randIn('visual', 0.7, 1.4), max: 1.4, grav: -0.03, soft: true
        });
    }
}

function burstEmpty(x, y) {
    for (let i = 0; i < 26; i++) {
        addParticle({
            x: x + randIn('visual', -50, 50), y: y + randIn('visual', -10, 14),
            vx: randIn('visual', -0.7, 0.7), vy: randIn('visual', -1.1, -0.15),
            size: randIn('visual', 2, 6), color: 'rgba(148,163,184,0.5)',
            life: randIn('visual', 0.6, 1.3), max: 1.3, grav: -0.01, soft: true
        });
    }
}

function addFloater(x, y, text, color, size = 26) {
    floaters.push({ x: x, y: y, text: text, color: color, life: 1.4, max: 1.4, size: size });
}

function shakeScreen(dur, mag) {
    shake.dur = dur; shake.time = dur; shake.mag = mag;
}

function flashScreen(dur, color) {
    flash.dur = dur; flash.time = dur; flash.color = color;
}

function updateEffects(dt) {
    const frameScale = dt * 60;
    if (shake.time > 0) shake.time = Math.max(0, shake.time - dt);
    if (flash.time > 0) flash.time = Math.max(0, flash.time - dt);

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * frameScale;
        p.y += p.vy * frameScale;
        p.vy += (p.grav || 0) * frameScale;
        p.vx *= Math.pow(0.985, frameScale);
        p.size *= Math.pow(p.soft ? 0.995 : 0.97, frameScale);
    }

    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt;
        if (f.life <= 0) { floaters.splice(i, 1); continue; }
        f.y -= 34 * dt;
    }
}

function drawEffects() {
    ctx.save();
    for (const p of particles) {
        const k = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = p.soft ? k * 0.65 : k;
        ctx.fillStyle = p.color;
        if (p.glow) {
            ctx.shadowBlur = 14;
            ctx.shadowColor = p.color;
        }
        if (p.soft) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, TAU);
            ctx.fill();
        } else {
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of floaters) {
        const k = clamp(f.life / f.max, 0, 1);
        ctx.globalAlpha = k < 0.25 ? k / 0.25 : 1;
        ctx.font = `800 ${f.size}px Manrope, Inter, sans-serif`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
}

