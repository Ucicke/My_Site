/* ================================================================
   SCROLL HUNTER · engine/chests.js — отрисовка сундуков
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   6. Сундуки
--------------------------------------------------------------- */
const WOOD_LIGHT = '#8a4d1c';
const WOOD_DARK = '#3d1f08';

function chestPalette(chest) {
    if (chest.known === 'scroll') return ['#b07c2c', '#553411'];
    if (chest.known === 'empty') return ['#7d6742', '#3a2e1c'];
    if (chest.known === 'mimic') return ['#933523', '#3c130c'];
    return [WOOD_LIGHT, WOOD_DARK];
}

/* Контур дугообразной крышки */
function lidPath(c, x, y, w, lh) {
    c.beginPath();
    c.moveTo(x, y + 3);
    c.lineTo(x, y - lh * 0.42);
    c.bezierCurveTo(x + w * 0.05, y - lh * 1.05, x + w * 0.25, y - lh * 1.08, x + w * 0.5, y - lh * 1.05);
    c.bezierCurveTo(x + w * 0.75, y - lh * 1.08, x + w * 0.95, y - lh * 1.05, x + w, y - lh * 0.42);
    c.lineTo(x + w, y + 3);
    c.closePath();
}

/* Маленькая паутина (веер из спиц) */
function drawCobweb(c, cx, cy, r, a0 = -Math.PI / 2, spread = 0.42) {
    c.save();
    c.strokeStyle = 'rgba(205,220,245,0.5)';
    c.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
        const a = a0 + i * spread;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        c.stroke();
    }
    for (let k = 1; k <= 2; k++) {
        c.beginPath();
        for (let i = 0; i <= 3; i++) {
            const a = a0 + i * spread;
            const px = cx + Math.cos(a) * r * (k / 2);
            const py = cy + Math.sin(a) * r * (k / 2);
            if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke();
    }
    c.restore();
}

/* Смешение цвета с белым/чёрным — для бликов и теней */
function shade(hex, amount) {
    const c = hex.replace('#', '');
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    const k = amount > 0 ? 255 : 0;
    const a = Math.abs(amount);
    const mix = v => Math.round(v + (k - v) * a);
    return 'rgb(' + mix(r) + ',' + mix(g) + ',' + mix(b) + ')';
}


/* Роги: фигура в плаще с фонарём, стоит внизу кадра */
function drawRogiFigure(t) {
    if (typeof companion !== 'undefined') {
        if (companion.active && typeof chamberImages !== 'undefined') containChamberImage(chamberImages['rogi-idle'], { x: 10, y: 95, w: 165, h: 250 });
        return;
    }
    if (!rogi) return;
    /* чем ближе он вам — тем ближе стоит и тем теплее горит фонарь */
    const trust = (typeof rogiTrust !== 'undefined') ? rogiTrust : 0;
    const x = 62 + Math.round(trust * 0.16);
    const footY = 344;
    const s = 1 + trust / 900;
    const sway = Math.sin(t * 1.6) * 2;
    const warm = clamp(0.35 + trust / 165, 0.08, 0.96);

    ctx.save();

    /* тень */
    const sh = ctx.createRadialGradient(x, footY, 2, x, footY, 46);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(x, footY, 46, 12, 0, 0, TAU);
    ctx.fill();

    /* плащ */
    const cloak = ctx.createLinearGradient(x - 30, footY - 110 * s, x + 30, footY);
    cloak.addColorStop(0, '#2a2240');
    cloak.addColorStop(0.5, '#3d3159');
    cloak.addColorStop(1, '#1b1629');
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(x - 26 * s, footY);
    ctx.quadraticCurveTo(x - 30 * s, footY - 70 * s, x - 15 * s, footY - 96 * s);
    ctx.quadraticCurveTo(x, footY - 112 * s, x + 15 * s, footY - 96 * s);
    ctx.quadraticCurveTo(x + 30 * s, footY - 70 * s, x + 26 * s, footY);
    ctx.closePath();
    ctx.fill();

    /* капюшон */
    ctx.fillStyle = '#241d38';
    ctx.beginPath();
    ctx.ellipse(x + sway * 0.3, footY - 100 * s, 18 * s, 20 * s, 0, 0, TAU);
    ctx.fill();

    /* тень лица и глаза */
    ctx.fillStyle = '#0b0812';
    ctx.beginPath();
    ctx.ellipse(x + sway * 0.3, footY - 98 * s, 11 * s, 13 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,200,120,0.9)';
    ctx.beginPath();
    ctx.arc(x - 4 * s + sway * 0.3, footY - 100 * s, 2.1 * s, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 4 * s + sway * 0.3, footY - 100 * s, 2.1 * s, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    /* фонарь */
    const lx = x + 32 * s;
    const ly = footY - 52 * s;
    ctx.strokeStyle = '#3a3350';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18 * s, footY - 74 * s);
    ctx.lineTo(lx, ly - 12 * s);
    ctx.stroke();
    ctx.save();
    ctx.shadowBlur = 26 + warm * 18;
    ctx.shadowColor = 'rgba(255,190,90,' + (0.75 + warm * 0.25).toFixed(2) + ')';
    ctx.fillStyle = trust >= 75 ? '#ffe0a8' : '#ffcf7a';
    roundRect(ctx, lx - 6 * s, ly - 10 * s, 12 * s, 17 * s, 3 * s);
    ctx.fill();
    ctx.restore();

    /* блик света на полу */
    const pool = ctx.createRadialGradient(lx, footY, 4, lx, footY, 90 + warm * 30);
    pool.addColorStop(0, 'rgba(255,190,90,' + (0.08 + warm * 0.12).toFixed(3) + ')');
    pool.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(lx, footY, 90 + warm * 30, 34, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
}

function drawChest(chest, t) {
    const x = chest.x;
    const y = chest.y;          // шов между крышкой и корпусом
    const w = chest.w || CHEST_W;
    const bh = Math.round(CHEST_BODY_H * (w / CHEST_W));
    const lh = Math.round(CHEST_LID_H * (w / CHEST_W));

    if (chest.destroyed) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + bh + 8, w * 0.48, 10, 0, 0, TAU);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
            ctx.save();
            ctx.translate(x + w * (0.12 + i * 0.14), y + bh - 5 + (i % 3) * 4);
            ctx.rotate((i % 2 ? 1 : -1) * (0.15 + i * 0.09));
            ctx.fillStyle = i % 2 ? '#49392c' : '#66503a';
            ctx.fillRect(-w * 0.07, -5, w * 0.27, 9);
            ctx.restore();
        }
        ctx.restore();
        return;
    }

    const open = easeOutCubic(clamp(chest.openT, 0, 1));
    const chestIndex = chests.indexOf(chest);
    const hovered = gameState === STATES.CHOOSE && !attemptOver && !chest.selected && !chest.opened &&
        typeof canvasMousePosition !== 'undefined' && canvasMousePosition &&
        typeof chestAt === 'function' && chestAt(canvasMousePosition) === chestIndex;
    const lift = chest.selected ? 6 : hovered ? 3 : 0;
    const pal = chestPalette(chest);

    /* Тень на полу */
    ctx.save();
    const sh = ctx.createRadialGradient(x + w / 2, y + bh + 12 - lift * 0.3, 4,
        x + w / 2, y + bh + 12 - lift * 0.3, w / 2.3);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)');
    sh.addColorStop(0.55, 'rgba(0,0,0,0.24)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + bh + 12 - lift * 0.3, w / 2.3, 14, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* Подсветка состояния — мягкое свечение без жёстких краёв */
    let glowRgb = null;
    let glowA = 0;
    if (chest.selected) { glowRgb = '255,199,64'; glowA = 0.26 + Math.sin(t * 3.4) * 0.07; }
    else if (hovered) { glowRgb = '217,158,58'; glowA = 0.15; }
    else if (chest.known === 'mimic') { glowRgb = '255,70,90'; glowA = 0.30 + Math.sin(t * 5) * 0.09; }
    else if (chest.known === 'scroll') { glowRgb = '255,205,80'; glowA = 0.32 + Math.sin(t * 4.2) * 0.08; }
    else if (chest.known === 'empty') { glowRgb = '120,200,160'; glowA = 0.22 + Math.sin(t * 3) * 0.05; }
    if (glowRgb) {
        const gcx = x + w / 2;
        const gcy = y + bh * 0.45;
        const grad = ctx.createRadialGradient(gcx, gcy, 16, gcx, gcy, w * 0.92);
        grad.addColorStop(0, `rgba(${glowRgb},${glowA})`);
        grad.addColorStop(0.45, `rgba(${glowRgb},${glowA * 0.5})`);
        grad.addColorStop(1, `rgba(${glowRgb},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - 70, y - lh - 70, w + 140, bh + lh + 140);
    }

    ctx.save();
    ctx.translate(0, -lift);

    drawChestSurface(x, y, w, bh, pal);    /* Крышка */
    drawChestLid(chest, x, y, w, lh, open, pal);

    /* Тёмная полость, которая появляется, когда крышка поднята */
    if (open > 0.03) {
        ctx.save();
        ctx.globalAlpha = open;
        const cav = ctx.createLinearGradient(0, y - 4, 0, y + 32);
        cav.addColorStop(0, '#010308');
        cav.addColorStop(1, '#0c1120');
        ctx.fillStyle = cav;
        roundRect(ctx, x + 12, y - 4, w - 24, 36, 7);
        ctx.fill();
        ctx.restore();
    }

    drawChestHardware(x, y, w, bh);    /* Содержимое вылезает наружу — поверх замка */
    if (open > 0.05) drawChestContents(chest, x, y, w, bh, open, t);

    /* Золотая обводка выбранного сундука */
    if (chest.selected) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,201,60,${0.45 + Math.sin(t * 4) * 0.2})`;
        ctx.lineWidth = 2;
        roundRect(ctx, x - 1.5, y - 1.5, w + 3, bh + 3, 9);
        ctx.stroke();
        ctx.restore();
    } else if (hovered) {
        ctx.save();
        ctx.strokeStyle = 'rgba(228,180,99,0.72)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x - 1, y - 1, w + 2, bh + 2, 8);
        ctx.stroke();
        ctx.restore();
    }

    /* Маркеры и подсказки */
    drawChestMarkers(chest, x, y, w, lh, t);

    ctx.restore();
}
function drawChestSurface(x, y, w, bh, pal) {
/* Корпус: тёплый верх, холодная тень внизу */
const bodyGrad = ctx.createLinearGradient(0, y, 0, y + bh);
bodyGrad.addColorStop(0, shade(pal[0], 0.18));
bodyGrad.addColorStop(0.18, pal[0]);
bodyGrad.addColorStop(0.72, shade(pal[1], 0.05));
bodyGrad.addColorStop(1, shade(pal[1], -0.35));
ctx.fillStyle = bodyGrad;
roundRect(ctx, x, y, w, bh, 7);
ctx.fill();

/* Рёбра досок */
ctx.save();
roundRect(ctx, x, y, w, bh, 7);
ctx.clip();
for (let i = 1; i < 4; i++) {
    const px = x + (w / 4) * i;
    ctx.strokeStyle = 'rgba(0,0,0,0.34)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + bh);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 1.5, y);
    ctx.lineTo(px + 1.5, y + bh);
    ctx.stroke();
}
ctx.restore();

/* Тень, которую крышка отбрасывает на корпус */
const seam = ctx.createLinearGradient(0, y, 0, y + 24);
seam.addColorStop(0, 'rgba(0,0,0,0.42)');
seam.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = seam;
ctx.fillRect(x + 1, y, w - 2, 24);

/* Доски */
ctx.strokeStyle = 'rgba(0,0,0,0.32)';
ctx.lineWidth = 2;
for (let i = 1; i < 4; i++) {
    const px = x + (w / 4) * i;
    ctx.beginPath();
    ctx.moveTo(px, y + 4);
    ctx.lineTo(px, y + bh - 4);
    ctx.stroke();
}
}

function drawChestHardware(x, y, w, bh) {
/* Металлическая обвязка корпуса */
const mg = ctx.createLinearGradient(x, 0, x + w, 0);
mg.addColorStop(0, '#5b6566');
mg.addColorStop(0.22, '#9aa5a6');
mg.addColorStop(0.55, '#788384');
mg.addColorStop(1, '#4d5657');
ctx.fillStyle = mg;
ctx.fillRect(x, y, 14, bh);
ctx.fillRect(x + w - 14, y, 14, bh);
ctx.fillStyle = 'rgba(0,0,0,0.45)';
ctx.fillRect(x + 10, y, 4, bh);
ctx.fillRect(x + w - 14, y, 4, bh);
ctx.fillStyle = 'rgba(255,255,255,0.12)';
ctx.fillRect(x + 1.5, y, 1.5, bh);
ctx.fillRect(x + w - 3, y, 1.5, bh);

/* Уголки */
ctx.fillStyle = 'rgba(255,255,255,0.14)';
ctx.fillRect(x, y, 15, 4);
ctx.fillRect(x + w - 15, y, 15, 4);

/* Замок на шве крышки */
const lx = x + w / 2;
ctx.fillStyle = '#c99a24';
roundRect(ctx, lx - 12, y - 8, 24, 30, 4);
ctx.fill();
const lockGrad = ctx.createLinearGradient(lx - 12, y - 8, lx + 12, y + 22);
lockGrad.addColorStop(0, 'rgba(255,235,170,0.55)');
lockGrad.addColorStop(0.5, 'rgba(255,235,170,0.05)');
lockGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
ctx.fillStyle = lockGrad;
roundRect(ctx, lx - 12, y - 8, 24, 30, 4);
ctx.fill();
ctx.strokeStyle = 'rgba(0,0,0,0.55)';
ctx.lineWidth = 1.5;
ctx.stroke();
ctx.fillStyle = '#2a1d02';
ctx.beginPath();
ctx.arc(lx, y + 4, 3.4, 0, TAU);
ctx.fill();
ctx.fillRect(lx - 1.7, y + 5, 3.4, 8);

/* Тёмный контур по силуэту */
ctx.strokeStyle = 'rgba(0,0,0,0.55)';
ctx.lineWidth = 2;
roundRect(ctx, x - 1, y - 1, w + 2, bh + 2, 8);
ctx.stroke();
}
