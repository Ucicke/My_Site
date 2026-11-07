/* ================================================================
   SCROLL HUNTER · engine/chest-details.js
   Детали отрисовки крышек, мимиков, содержимого и подсказок.
   ================================================================ */
'use strict';

function drawChestLid(chest, x, y, w, lh, open, pal) {
    const hingeY = y + 2;

    ctx.save();
    ctx.translate(x + w / 2, hingeY);
    ctx.scale(1 + open * 0.05, 1 - open * 0.86);
    ctx.rotate(-open * 0.045);
    ctx.translate(-(x + w / 2), -hingeY);

    /* Дерево */
    const lg = ctx.createLinearGradient(0, y - lh, 0, y);
    lg.addColorStop(0, shade(pal[0], 0.3));
    lg.addColorStop(0.5, shade(pal[0], 0.08));
    lg.addColorStop(1, shade(pal[1], 0.08));
    ctx.fillStyle = lg;
    lidPath(ctx, x, y, w, lh);
    ctx.fill();

    /* Тёмный шов между крышкой и корпусом */
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(x, y - 1, w, 4);

    /* Блик по гребню */
    ctx.save();
    ctx.clip();
    const hl = ctx.createLinearGradient(0, y - lh, 0, y - lh * 0.3);
    hl.addColorStop(0, 'rgba(255,255,255,0.26)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(x, y - lh, w, lh * 0.75);
    ctx.restore();

    /* Обвязка крышки */
    ctx.save();
    lidPath(ctx, x, y, w, lh);
    ctx.clip();
    const mg = ctx.createLinearGradient(x, 0, x + w, 0);
    mg.addColorStop(0, '#5b6566');
    mg.addColorStop(0.22, '#9aa5a6');
    mg.addColorStop(0.55, '#788384');
    mg.addColorStop(1, '#4d5657');
    ctx.fillStyle = mg;
    ctx.fillRect(x, y - lh - 2, 15, lh + 6);
    ctx.fillRect(x + w - 15, y - lh - 2, 15, lh + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 11, y - lh - 2, 4, lh + 6);
    ctx.fillRect(x + w - 15, y - lh - 2, 4, lh + 6);
    ctx.restore();

    /* Нижний ободок крышки */
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(x, y - 4, w, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y - 4, w, 2);

    ctx.restore();
}


/* Мимик: лицо на самом сундуке — глаза на стенке, пасть на шве */
function drawMimicFace(x, y, w, bh, open, t) {
    const sx = w / CHEST_W;
    const sy = bh / CHEST_BODY_H;
    const gape = 14 + open * 30;
    const eyeY = 24;
    const mouthTop = eyeY + 14;
    const chomp = open > 0.5 ? Math.max(0, Math.sin(t * 9)) * 4 : 0;
    const cx = CHEST_W / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);

    /* Face details share the chest's original 220 × 92 coordinate system. */
    ctx.fillStyle = '#150303';
    roundRect(ctx, 26, mouthTop, CHEST_W - 52, gape + 4, 8);
    ctx.fill();

    ctx.fillStyle = '#f4ecd8';
    const upper = Math.max(3, Math.round((CHEST_W - 60) / 34));
    for (let i = 0; i < upper; i++) {
        const tx = 34 + i * ((CHEST_W - 68) / (upper - 1 || 1));
        ctx.beginPath();
        ctx.moveTo(tx - 7, mouthTop - 2);
        ctx.lineTo(tx, mouthTop + 15 + chomp);
        ctx.lineTo(tx + 7, mouthTop - 2);
        ctx.closePath();
        ctx.fill();
    }

    const lower = Math.max(2, upper - 2);
    for (let i = 0; i < lower; i++) {
        const tx = 48 + i * ((CHEST_W - 96) / (lower - 1 || 1));
        ctx.beginPath();
        ctx.moveTo(tx - 6, mouthTop + gape + 2);
        ctx.lineTo(tx, mouthTop + gape - 13 - chomp);
        ctx.lineTo(tx + 6, mouthTop + gape + 2);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = '#8c2b30';
    ctx.beginPath();
    ctx.ellipse(cx, mouthTop + gape - 2, 34, 9, 0, 0, Math.PI);
    ctx.fill();

    for (const ex of [cx - 40, cx + 40]) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255,40,60,0.9)';
        ctx.fillStyle = '#ff2f3f';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 13, 10, 0, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#260205';
        const look = Math.sin(t * 2.2) * 3;
        ctx.beginPath();
        ctx.ellipse(ex + look, eyeY, 5, 7, 0, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = 'rgba(20,4,6,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex - 14, eyeY - 14);
        ctx.lineTo(ex + 13, eyeY - 19);
        ctx.stroke();
    }

    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.moveTo(30, mouthTop - 2);
    ctx.lineTo(38, mouthTop + 24);
    ctx.lineTo(46, mouthTop - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(CHEST_W - 30, mouthTop - 2);
    ctx.lineTo(CHEST_W - 38, mouthTop + 24);
    ctx.lineTo(CHEST_W - 46, mouthTop - 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawChestContents(chest, x, y, w, bh, open, t) {
    const cx = x + w / 2;

    if (chest.type === 'scroll') {
        const k = w / CHEST_W;
        const rise = easeOutBack(clamp(open * 1.2, 0, 1));
        const sy = y + 52 * k - rise * 92 * k;
        const sw = 108 * k * rise;
        const sh = 40 * k * rise;
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = 'rgba(255,200,70,0.95)';
        const pg = ctx.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);
        pg.addColorStop(0, '#e3cd96');
        pg.addColorStop(0.3, '#fffaf0');
        pg.addColorStop(0.68, '#f4e4b8');
        pg.addColorStop(1, '#d4bd88');
        ctx.fillStyle = pg;
        roundRect(ctx, cx - sw / 2, sy - sh / 2, sw, sh, 5);
        ctx.fill();
        ctx.shadowBlur = 0;

        /* Лента */
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(cx - 9, sy - sh / 2, 18, sh);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(cx - 9, sy - sh / 2, 5, sh);

        /* Строки письма */
        ctx.strokeStyle = 'rgba(150,100,25,0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - sw / 2 + 15, sy + 4);
        ctx.lineTo(cx + sw / 2 - 15, sy + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - sw / 2 + 15, sy - 6);
        ctx.lineTo(cx + sw / 2 - 15, sy - 6);
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (chest.type === 'mimic') {
        drawMimicFace(x, y, w, bh, open, t);
        return;
    }

    /* Пусто: паутина внутри и пыль */
    ctx.save();
    ctx.globalAlpha = clamp(open, 0, 1) * 0.75;
    drawCobweb(ctx, cx - 46, y + 10, 34);
    ctx.restore();
}

function drawChestMarkers(chest, x, y, w, lh, t) {
    const cx = x + w / 2;
    const my = y - lh - 30;

    /* Указатель на выбранный сундук (если вердикта нет — значок не нужен) */
    if (chest.selected && !chest.known) {
        const bob = Math.sin(t * 4) * 3;
        ctx.save();
        ctx.translate(cx, my + bob);
        ctx.shadowBlur = 16;
        ctx.shadowColor = 'rgba(255,200,60,0.95)';
        ctx.fillStyle = '#ffc93c';
        ctx.beginPath();
        ctx.moveTo(0, 13); ctx.lineTo(-12, -4); ctx.lineTo(12, -4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    if (!chest.known) {
        /* Подсказка коз: отдельный значок, чтобы не путать с ответами Роги */
        if (chest.hint) {
            ctx.save();
            ctx.translate(cx, my);
            ctx.shadowBlur = 14;
            ctx.shadowColor = 'rgba(190,140,255,0.9)';
            ctx.fillStyle = 'rgba(30,20,52,0.92)';
            ctx.strokeStyle = 'rgba(190,140,255,0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.font = '17px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🐐', 0, 1);
            ctx.restore();
        }
        return;
    }

    /* Значок ответа Роги */
    const known = chest.known;
    const color = known === 'mimic' ? '#ff4d6d'
        : known === 'scroll' ? '#ffc93c'
            : known === 'not_empty' ? '#8ecbff'
                : '#5fd3a4';
    ctx.save();
    ctx.translate(cx, my);
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(8,12,24,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.6;
    if (known === 'mimic') {
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(0, 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 6, 2, 0, TAU);
        ctx.fill();
    } else if (known === 'scroll') {
        ctx.beginPath();
        ctx.moveTo(-5, -7); ctx.lineTo(5, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(-5, -7);
        ctx.moveTo(8, -8); ctx.lineTo(5, -7);
        ctx.stroke();
    } else if (known === 'safe') {
        /* мимика нет: круг с чертой */
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
        ctx.stroke();
    } else if (known === 'not_empty') {
        /* не пусто: две точки */
        ctx.beginPath();
        ctx.arc(-4, 0, 2.4, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, 0, 2.4, 0, TAU);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
        ctx.moveTo(5, -5); ctx.lineTo(-5, 5);
        ctx.stroke();
    }
    ctx.restore();
}

